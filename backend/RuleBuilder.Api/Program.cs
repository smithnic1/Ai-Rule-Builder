using System.Collections.Generic;
using System.IO;
using Microsoft.AspNetCore.Http;
using RuleBuilder.Api.Services;

LoadEnvFile();

var builder = WebApplication.CreateBuilder(args);
const string FrontendCorsPolicy = "AllowFrontend";
var allowedOrigins = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
{
    "http://localhost:5174",
    "https://localhost:5174",
    "http://127.0.0.1:5174",
    "https://127.0.0.1:5174",
    "http://localhost:5000",
    "https://localhost:5000",
    "http://127.0.0.1:5000",
    "https://127.0.0.1:5000"
};

var additionalOrigins = Environment.GetEnvironmentVariable("ALLOWED_CORS_ORIGINS");
if (!string.IsNullOrWhiteSpace(additionalOrigins))
{
    foreach (var origin in additionalOrigins.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
    {
        allowedOrigins.Add(origin);
    }
}

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
        policy.SetIsOriginAllowed(origin => IsAllowedOrigin(origin, allowedOrigins))
              .AllowAnyHeader()
              .AllowAnyMethod());
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

app.UseRouting();
app.UseCors(FrontendCorsPolicy);
app.MapControllers().RequireCors(FrontendCorsPolicy);
app.MapMethods("{*path}", [HttpMethods.Options], () => Results.Ok())
   .RequireCors(FrontendCorsPolicy);

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

static bool IsAllowedOrigin(string? origin, ISet<string> allowedOrigins)
{
    if (string.IsNullOrWhiteSpace(origin))
    {
        return false;
    }

    if (allowedOrigins.Contains(origin))
    {
        return true;
    }

    if (Uri.TryCreate(origin, UriKind.Absolute, out var uri))
    {
        if (uri.Host.EndsWith(".app.github.dev", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }
    }

    return false;
}
