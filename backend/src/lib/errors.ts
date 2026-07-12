export class ApiError extends Error {
  status: number;
  errorName: string;

  constructor(status: number, errorName: string, message: string) {
    super(message);
    this.status = status;
    this.errorName = errorName;
  }
}

export const badRequest = (message: string) => new ApiError(400, "Bad Request", message);
export const unauthorized = (message: string) => new ApiError(401, "Unauthorized", message);
export const forbidden = (message: string) => new ApiError(403, "Forbidden", message);
export const notFound = (message: string) => new ApiError(404, "Not Found", message);
export const conflict = (message: string) => new ApiError(409, "Conflict", message);
export const unprocessable = (message: string) => new ApiError(422, "Unprocessable Entity", message);
export const locked = (message: string) => new ApiError(423, "Locked", message);
