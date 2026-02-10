using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddCors(options =>
{
    options.AddPolicy("client", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors("client");

app.MapPost("/api/race/simulate", (RaceSimRequest request) =>
{
    if (request.Participants is null || request.Participants.Count == 0)
    {
        return Results.BadRequest(new ProblemDetails
        {
            Title = "Participants are required.",
            Detail = "Provide at least one participant name.",
            Status = StatusCodes.Status400BadRequest
        });
    }

    if (request.DurationSeconds is < 5 or > 180)
    {
        return Results.BadRequest(new ProblemDetails
        {
            Title = "Invalid duration.",
            Detail = "DurationSeconds must be between 5 and 180.",
            Status = StatusCodes.Status400BadRequest
        });
    }

    var rng = new Random();
    var emojis = new[]
    {
        "🏎️", "🐎", "🐢", "🚴", "🚀", "🚗", "🐇", "🦊", "🦄", "🏍️", "🛹", "🚢"
    };

    var racers = request.Participants
        .Select((name, index) => new RacerState
        {
            Id = Guid.NewGuid().ToString("N"),
            Name = name.Trim(),
            Emoji = emojis[index % emojis.Length],
            Position = 0,
            BaseSpeed = 0,
            Jitter = 0,
            FinalSpeed = null,
            MaxEnd = null
        })
        .Where(racer => !string.IsNullOrWhiteSpace(racer.Name))
        .ToList();

    if (racers.Count == 0)
    {
        return Results.BadRequest(new ProblemDetails
        {
            Title = "Participants are required.",
            Detail = "Participant names cannot be empty.",
            Status = StatusCodes.Status400BadRequest
        });
    }

    const int tickMs = 100;
    const double trackLength = 100.0;
    var totalDurationMs = request.DurationSeconds * 1000;
    var totalTicks = totalDurationMs / tickMs;
    var riggedStartMs = (int)Math.Round(totalDurationMs * 0.75);

    var targetSpeed = trackLength / request.DurationSeconds;
    foreach (var racer in racers)
    {
        racer.BaseSpeed = targetSpeed * RandomRange(rng, 0.75, 1.25);
        racer.Jitter = targetSpeed * 0.35;
    }

    var winnerIndex = rng.Next(racers.Count);
    var winnerId = racers[winnerIndex].Id;

    var ticks = new List<RaceTick>(totalTicks + 1);

    for (var tick = 0; tick <= totalTicks; tick++)
    {
        var timeMs = tick * tickMs;
        var dt = tickMs / 1000.0;

        if (timeMs >= riggedStartMs && racers.All(r => r.FinalSpeed is null))
        {
            var remainingTime = Math.Max((totalDurationMs - timeMs) / 1000.0, 0.001);
            foreach (var racer in racers)
            {
                var remainingDistance = trackLength - racer.Position;
                if (racer.Id == winnerId)
                {
                    // Apply 100% boost to winner (double the speed)
                    racer.FinalSpeed = Math.Max((remainingDistance / remainingTime) * 2.0, 0);
                }
                else
                {
                    // Increased boost by 50%: range changed from (0.6-1.8) to (0.9-2.7)
                    var maxEnd = Math.Max(trackLength - RandomRange(rng, 0.9, 2.7), racer.Position + 0.1);
                    racer.MaxEnd = maxEnd;
                    racer.FinalSpeed = Math.Max((maxEnd - racer.Position) / remainingTime, 0);
                }
            }
        }

        if (tick > 0)
        {
            foreach (var racer in racers)
            {
                var isRiggedPhase = timeMs >= riggedStartMs && racer.FinalSpeed.HasValue;
                var speed = isRiggedPhase
                    ? racer.FinalSpeed.GetValueOrDefault()
                    : Math.Max(0.5, racer.BaseSpeed + RandomRange(rng, -racer.Jitter, racer.Jitter));

                racer.Position = Math.Min(trackLength, racer.Position + speed * dt);

                if (isRiggedPhase && racer.Id != winnerId && racer.MaxEnd.HasValue)
                {
                    racer.Position = Math.Min(racer.Position, racer.MaxEnd.Value);
                }

                // Track finish time when racer crosses the finish line
                if (racer.FinishTimeMs is null && racer.Position >= trackLength)
                {
                    racer.FinishTimeMs = timeMs;
                }
            }
        }

        if (tick == totalTicks)
        {
            foreach (var racer in racers)
            {
                if (racer.Id == winnerId)
                {
                    racer.Position = trackLength;
                }
                else if (racer.MaxEnd.HasValue)
                {
                    racer.Position = Math.Min(racer.Position, racer.MaxEnd.Value);
                }

                // Ensure all racers have a finish time
                if (racer.FinishTimeMs is null)
                {
                    racer.FinishTimeMs = totalDurationMs;
                }
            }
        }

        ticks.Add(new RaceTick(
            timeMs,
            racers.Select(racer => new RacerPosition(racer.Id, racer.Position)).ToList()
        ));
    }

    var finalOrder = racers
        .OrderByDescending(racer => racer.Position)
        .ToList();

    var results = finalOrder
        .Select((racer, index) => new RaceResult(
            racer.Id,
            racer.Name,
            index + 1,
            racer.FinishTimeMs ?? totalDurationMs
        ))
        .ToList();

    var response = new RaceSimResponse(
        request.DurationSeconds,
        tickMs,
        trackLength,
        riggedStartMs,
        winnerId,
        racers.Select(racer => new RacerInfo(racer.Id, racer.Name, racer.Emoji)).ToList(),
        ticks,
        results
    );

    return Results.Ok(response);
});

app.Run();

static double RandomRange(Random rng, double min, double max)
{
    return min + (rng.NextDouble() * (max - min));
}

record RaceSimRequest(List<string> Participants, int DurationSeconds);

record RaceSimResponse(
    int DurationSeconds,
    int TickMs,
    double TrackLength,
    int RiggedStartMs,
    string WinnerId,
    IReadOnlyList<RacerInfo> Racers,
    IReadOnlyList<RaceTick> Ticks,
    IReadOnlyList<RaceResult> Results);

record RacerInfo(string Id, string Name, string Emoji);

record RaceTick(int TimeMs, IReadOnlyList<RacerPosition> Positions);

record RacerPosition(string Id, double Position);

record RaceResult(string Id, string Name, int Place, int FinishTimeMs);

class RacerState
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Emoji { get; set; } = "";
    public double Position { get; set; }
    public double BaseSpeed { get; set; }
    public double Jitter { get; set; }
    public double? FinalSpeed { get; set; }
    public double? MaxEnd { get; set; }
    public int? FinishTimeMs { get; set; }
}
