// TODO 06Apr20: Do we really want these here?

export class EmptyRequest { }

export class EmptyResponse { }

export class ErrorResponse {
    
    readonly ErrorResponse: boolean;
    
    readonly name: string;
    readonly message: string;
    readonly stack?: string;

    constructor (error: Error) {
        this.ErrorResponse = true;
        this.name = error.name;
        this.message = error.message;
        this.stack = error.stack;
    }
}