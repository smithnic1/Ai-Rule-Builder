using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using RuleBuilder.Api.Services;

namespace RuleBuilder.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RulePipelineController(AiService ai) : ControllerBase
{
    private readonly AiService _ai = ai ?? throw new ArgumentNullException(nameof(ai));

    [HttpPost("extract")]
    public async Task<IActionResult> Extract([FromBody] InputDto? dto, CancellationToken cancellationToken)
    {
        if (dto is null || string.IsNullOrWhiteSpace(dto.Text))
        {
            return BadRequest("Text is required.");
        }

        try
        {
            var normalized = await _ai.ExtractRulePipeline(dto.Text, cancellationToken);
            using var doc = JsonDocument.Parse(normalized);
            var payload = doc.RootElement.Clone();
            return Ok(new { result = payload });
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
        }
    }

    [HttpPost("refine")]
    public async Task<IActionResult> Refine([FromBody] InputDto? dto)
    {
        if (dto is null || string.IsNullOrWhiteSpace(dto.Text))
        {
            return BadRequest("Text is required.");
        }

        try
        {
            var normalized = await _ai.RefineRuleJson(dto.Text);
            using var doc = JsonDocument.Parse(normalized);
            var payload = doc.RootElement.Clone();
            return Ok(new { result = payload });
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
        }
    }

    public record InputDto(string Text);
}
