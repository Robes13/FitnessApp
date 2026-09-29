using FitnessApp.Api.DTOs.Metadata;
using FitnessApp.Api.Services.Metadata;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitnessApp.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/v1/metadata")]
public sealed class MetadataController(MetadataService metadataService) : ControllerBase
{
    private readonly MetadataService _metadataService = metadataService;

    [HttpGet]
    public ActionResult<MetadataDto> Get() => Ok(_metadataService.Get());
}
