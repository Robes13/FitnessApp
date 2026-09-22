import { ApiError } from '../../core/models/api-error';

/**
 * Sidste udvej, hvis noget andet end en `ApiError` fejler. Mock-backenden fejler altid med en
 * `ApiError`, så teksten er i praksis ikke synlig – men brugeren skal aldrig se en teknisk fejl.
 */
const FALLBACK_MESSAGE = 'Noget gik galt. Prøv igen.';

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as Partial<ApiError>).message === 'string'
  );
}

/** Oversætter en fejl fra `AuthApi` til en dansk tekst, der kan vises direkte til brugeren. */
export function authErrorMessage(error: unknown): string {
  return isApiError(error) ? error.message : FALLBACK_MESSAGE;
}
