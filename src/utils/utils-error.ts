type ErrorOptions = {
  statusCode?: number;
  message?: string;
  extraData?: Record<string, any>; //Только для логирования
};

export class HttpError extends Error {
  statusCode: number;
  extraData: Record<string, any>;

  constructor({ statusCode = 400, message = 'Error', extraData = {} }: ErrorOptions) {
    super(message);
    this.statusCode = statusCode;
    this.extraData = extraData;
  }
}

export function throwError(options: ErrorOptions): never {
  throw new HttpError(options);
}

export function throwErrorSimple(message: string, extraData: Record<string, any> = {}): never {
  throw new HttpError({
    message,
    extraData,
  });
}

export function throwErrorCode(message: string, statusCode: number, extraData: Record<string, any> = {}): never {
  throw new HttpError({
    message,
    statusCode,
    extraData,
  });
}

export function throwErrorNotFound(message: string = 'Not found', extraData: Record<string, any> = {}): never {
  throw new HttpError({
    statusCode: 404,
    message,
    extraData,
  });
}
