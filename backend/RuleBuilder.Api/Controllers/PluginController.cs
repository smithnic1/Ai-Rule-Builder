using Microsoft.AspNetCore.Mvc;
using RuleBuilder.Api.Services;

namespace RuleBuilder.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PluginController(AiService aiService) : ControllerBase
{
    private readonly AiService _aiService = aiService;

    [HttpPost("summarize")]
    public async Task<IActionResult> Summarize([FromBody] InputDto dto, CancellationToken cancellationToken)
    {
        if (dto is null || string.IsNullOrWhiteSpace(dto.Text))
        {
            return BadRequest("Text is required.");
        }

        var summary = await _aiService.SummarizeAsync(dto.Text, cancellationToken);
        return Ok(new { summary });
    }

    public record InputDto(string Text);
}
