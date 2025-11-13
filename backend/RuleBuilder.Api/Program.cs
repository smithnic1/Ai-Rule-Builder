using System.IO;
using RuleBuilder.Api.Services;

LoadEnvFile();

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyHeader()
              .AllowAnyMethod()
              .WithOrigins("http://localhost:5173", "http://127.0.0.1:5173"));
});

builder.Services.AddSingleton(provider =>
{
    var apiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY");

    if (string.IsNullOrWhiteSpace(apiKey))
    {
        throw new InvalidOperationException("OPENAI_API_KEY is not set. Add it to .env or export it before running the API.");
    }

    return new AiService(apiKey);
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.MapControllers();

app.Run();

static void LoadEnvFile()
{
    var envPath = Path.Combine(Directory.GetCurrentDirectory(), ".env");

    if (!File.Exists(envPath))
    {
        return;
    }

    foreach (var rawLine in File.ReadLines(envPath))
    {
        var line = rawLine.Trim();

        if (string.IsNullOrWhiteSpace(line) || line.StartsWith('#'))
        {
            continue;
        }

        var separatorIndex = line.IndexOf('=');
        if (separatorIndex <= 0)
        {
            continue;
        }

        var key = line[..separatorIndex].Trim();
        var value = line[(separatorIndex + 1)..].Trim().Trim('"');

        if (!string.IsNullOrEmpty(key))
        {
            Environment.SetEnvironmentVariable(key, value);
        }
    }
}
