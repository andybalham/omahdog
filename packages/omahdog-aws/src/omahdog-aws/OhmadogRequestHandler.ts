// TODO 16Jul20: These are internal messages, with a call context, response context etc
class OmahdogRequest {
}
class OmahdogResponse {
}

export class OmahdogRequestHandler {
    
    async handle(message: OmahdogRequest | OmahdogResponse): Promise<OmahdogResponse> {

        // TODO 16Jul20: Our job here is to un-package the message, handle the request or response, and package that response back to the caller

        console.log(`message: ${JSON.stringify(message)}`);

        return new OmahdogResponse;
    }
}