using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace FitnessApp.Api.Utilities;

public sealed class SwaggerAuthorizationOperationFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var controller = context.MethodInfo.DeclaringType;
        var anonymous = context.MethodInfo.IsDefined(typeof(AllowAnonymousAttribute), true)
            || controller?.IsDefined(typeof(AllowAnonymousAttribute), true) == true;
        var authorized = context.MethodInfo.IsDefined(typeof(AuthorizeAttribute), true)
            || controller?.IsDefined(typeof(AuthorizeAttribute), true) == true;
        if (anonymous || !authorized) return;

        operation.Security ??= new List<OpenApiSecurityRequirement>();
        operation.Security.Add(new OpenApiSecurityRequirement
        {
            [new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            }] = Array.Empty<string>()
        });
    }
}
