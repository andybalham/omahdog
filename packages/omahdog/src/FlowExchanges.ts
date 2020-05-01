// TODO 06Apr20: Do we really want these here?

export class EmptyRequest { }

export class EmptyResponse { }

export class AsyncErrorResponse {
    get AsyncErrorResponse(): boolean { return true; }
    readonly message: string;
    constructor (message: string) {
        this.message = message;
    }
}