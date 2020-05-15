import { Lambda } from 'aws-sdk';
import uuid = require('uuid');
import { FlowContext, IActivityRequestHandler, AsyncResponse } from '../omahdog/FlowContext';
import { ErrorResponse } from '../omahdog/FlowExchanges';
import { AsyncRequestMessage, AsyncResponseMessage } from './AsyncExchange';

export class ActivityRequestLambdaProxy<TReq, TRes> implements IActivityRequestHandler<TReq, TRes> {
    
    readonly functionName?: string;

    constructor(functionName?: string) {
        this.functionName = functionName;
    }

    async handle(flowContext: FlowContext, request: TReq): Promise<TRes | AsyncResponse | ErrorResponse> {
        
        console.log(`Lambda proxy for ${this.functionName} called with: ${JSON.stringify(request)}`);
        
        if (this.functionName === undefined) throw new Error('this.functionName === undefined');

        const requestId = uuid.v4();

        const message: AsyncRequestMessage = 
            {
                callingContext: {
                    requestId: requestId,
                    flowInstanceId: flowContext.instanceId,
                    flowCorrelationId: flowContext.correlationId,
                    handlerTypeName: flowContext.rootHandlerTypeName
                },
                request: request
            };

        const invocationRequest: Lambda.Types.InvocationRequest = {
            FunctionName: this.functionName,
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify(message)            
        };

        const lambda = new Lambda();

        const invokeResult = await lambda.invoke(invocationRequest).promise();

        console.log(`invokeResult: ${JSON.stringify(invokeResult)}`);

        if (invokeResult.FunctionError !== undefined) {
            console.error(`Error invoking function ${this.functionName}: ${JSON.stringify(invokeResult)}`);
            throw new Error(`Error invoking function ${this.functionName}`);
        }

        if (typeof invokeResult.Payload === undefined) {
            return flowContext.getAsyncResponse(requestId);
        }

        if (typeof invokeResult.Payload !== 'string') {
            throw new Error('typeof invokeResult.Payload !== \'string\'');
        }

        const responseMessage: AsyncResponseMessage = JSON.parse(invokeResult.Payload);

        const response: TRes | AsyncResponse | ErrorResponse = responseMessage.response;

        if ('ErrorResponse' in response) {
            console.error(`ErrorResponse received from ${this.functionName}: ${JSON.stringify(response)}`);
            throw new Error(`ErrorResponse received from ${this.functionName}`);
        }

        return response;
    }
}
