import { CallContext } from '../omahdog/FlowContext';

// TODO 16Jul20: These are internal messages, with a call context, response context etc

export class OmahdogRequest {
    callContext: CallContext;
    requesterId: string;
    requestId: string;
    request: any;
}

export class OmahdogResponse {
    requestId: string;
    response: any;
}

// TODO 16Jul20: Other classes will wrap round this, e.g.:

// OmahdogRequestLambda - This could handle SNS or direct

// The following all result in lambdas, but they can never respond asynchronously (i.e. there is no response context supplied)
// RequestLambda - This could allow a transform on the way in and way out
// ApiGatewayRequestLambda
// SNSRequestLambda
// SQSRequestLambda
// S3EventLambda

// TODO 16Jul20: Should this be a base class or a dependency? Dependency I think

export class OmahdogRequestHandler {
    
    async handle(message: OmahdogRequest | OmahdogResponse): Promise<OmahdogResponse> {

        // TODO 16Jul20: Our job here is to un-package the message, handle the request or response, and package that response back to the caller

        console.log(`message: ${JSON.stringify(message)}`);

        if ('requestBody' in message) {
            console.log(message);
        } else {
            console.log(message);            
        }
        return new OmahdogResponse;
    }
}