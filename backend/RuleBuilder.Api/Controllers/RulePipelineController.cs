using System.Text.Json;
using System.Threading;
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

    [HttpPost("validate")]
    public async Task<IActionResult> Validate([FromBody] InputDto? dto, CancellationToken cancellationToken)
    {
        if (dto is null || string.IsNullOrWhiteSpace(dto.Text))
        {
            return BadRequest("Text is required.");
        }

        try
        {
            var result = await _ai.ValidateRuleWithSk(dto.Text, cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
        }
    }

    [HttpPost("explain")]
    public async Task<IActionResult> Explain([FromBody] InputDto? dto, CancellationToken cancellationToken)
    {
        if (dto is null || string.IsNullOrWhiteSpace(dto.Text))
        {
            return BadRequest("Text is required.");
        }

        try
        {
            var explanation = await _ai.ExplainRuleAsync(dto.Text, cancellationToken);
            return Ok(new { explanation });
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
        }
    }

    [HttpPost("assist")]
    public async Task<IActionResult> Assist([FromBody] InputDto dto)
    {
        var result = await _ai.AssistRuleJson(dto.Text);
        return Ok(new { result });
    }

    [HttpPost("fromtext")]
    public async Task<IActionResult> FromText([FromBody] InputDto dto)
    {
        var result = await _ai.ExtractRulePipeline(dto.Text);
        return Ok(new { result });
    }

    public record InputDto(string Text);
}
