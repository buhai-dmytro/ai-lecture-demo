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
    
    var targetSpeed = trackLength / request.DurationSeconds;
    foreach (var racer in racers)
    {
        racer.BaseSpeed = targetSpeed * RandomRange(rng, 0.9, 1.1);
        racer.Jitter = 0;
        racer.CurrentAcceleration = racer.BaseSpeed * RandomRange(rng, 0.07, 0.15);
        racer.LastAccelerationUpdateTime = 0;
        racer.BoostedRacer = false;
    }

    var boostedRacerIndex = rng.Next(racers.Count);
    var boostedRacerId = racers[boostedRacerIndex].Id;
    racers[boostedRacerIndex].BoostedRacer = true;

    var winnerIndex = rng.Next(racers.Count);
    var winnerId = racers[winnerIndex].Id;

    var ticks = new List<RaceTick>(totalTicks + 1);
    var boostTriggered = false;
    var riggedStartMs = 0;

    for (var tick = 0; tick <= totalTicks; tick++)
    {
        var timeMs = tick * tickMs;
        var dt = tickMs / 1000.0;
        var timeSeconds = timeMs / 1000.0;

        // Update acceleration every second for all racers
        foreach (var racer in racers)
        {
            if (timeSeconds >= racer.LastAccelerationUpdateTime + 1.0)
            {
                racer.CurrentAcceleration = racer.BaseSpeed * RandomRange(rng, 0.07, 0.15);
                racer.LastAccelerationUpdateTime = timeSeconds;
            }
        }

        // Check if boosted racer reached 50% and trigger boost
        var boostedRacer = racers.First(r => r.Id == boostedRacerId);
        if (!boostTriggered && boostedRacer.Position >= trackLength * 0.5)
        {
            boostTriggered = true;
            riggedStartMs = timeMs;
            
            // Calculate boost: push forward by 25-40% of track length
            var boostDistance = trackLength * RandomRange(rng, 0.25, 0.40);
            boostedRacer.BoostStartPosition = boostedRacer.Position;
            boostedRacer.BoostTargetPosition = Math.Min(trackLength, boostedRacer.Position + boostDistance);
        }

        // Apply rigged finish logic at 90% of time if boost was triggered
        if (boostTriggered && timeMs >= totalDurationMs * 0.9 && racers.All(r => r.FinalSpeed is null))
        {
            var remainingTime = Math.Max((totalDurationMs - timeMs) / 1000.0, 0.001);
            foreach (var racer in racers)
            {
                var remainingDistance = trackLength - racer.Position;
                if (racer.Id == winnerId)
                {
                    racer.FinalSpeed = Math.Max(remainingDistance / remainingTime, 0);
                }
                else
                {
                    var maxEnd = Math.Max(trackLength - RandomRange(rng, 0.6, 1.8), racer.Position + 0.1);
                    racer.MaxEnd = maxEnd;
                    racer.FinalSpeed = Math.Max((maxEnd - racer.Position) / remainingTime, 0);
                }
            }
        }

        if (tick > 0)
        {
            foreach (var racer in racers)
            {
                var isRiggedPhase = racer.FinalSpeed.HasValue;
                
                if (isRiggedPhase)
                {
                    // In final rigged phase, use calculated final speed
                    var speed = racer.FinalSpeed.GetValueOrDefault();
                    racer.Position = Math.Min(trackLength, racer.Position + speed * dt);
                    
                    if (racer.Id != winnerId && racer.MaxEnd.HasValue)
                    {
                        racer.Position = Math.Min(racer.Position, racer.MaxEnd.Value);
                    }
                }
                else if (racer.BoostedRacer && boostTriggered && racer.Position < racer.BoostTargetPosition.GetValueOrDefault())
                {
                    // Boosted racer accelerating rapidly
                    var boostSpeed = racer.BaseSpeed * 3.0; // 3x speed for rapid acceleration
                    racer.Position = Math.Min(racer.BoostTargetPosition.GetValueOrDefault(), racer.Position + boostSpeed * dt);
                }
                else
                {
                    // Normal racing: base speed + current acceleration
                    var speed = Math.Max(0.5, racer.BaseSpeed + racer.CurrentAcceleration);
                    racer.Position = Math.Min(trackLength, racer.Position + speed * dt);
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
            totalDurationMs
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
    public double CurrentAcceleration { get; set; }
    public double LastAccelerationUpdateTime { get; set; }
    public bool BoostedRacer { get; set; }
    public double? BoostStartPosition { get; set; }
    public double? BoostTargetPosition { get; set; }
}
