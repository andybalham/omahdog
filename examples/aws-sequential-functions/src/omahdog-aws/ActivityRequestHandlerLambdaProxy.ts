import { Lambda } from 'aws-sdk';
import uuid = require('uuid');
import { FlowContext, IActivityRequestHandler, AsyncResponse } from '../omahdog/FlowContext';
import { ErrorResponse } from '../omahdog/FlowExchanges';
import { AsyncRequestMessage, AsyncResponseMessage } from './AsyncExchange';

export class ActivityRequestHandlerLambdaProxy<TReq, TRes> implements IActivityRequestHandler<TReq, TRes> {
    
    private readonly _functionName?: string;

    constructor(_RequestType: new() => TReq, _ResponseType: new() => TRes, functionName?: string) {
        this._functionName = functionName;
    }

    async handle(flowContext: FlowContext, request: TReq): Promise<TRes | AsyncResponse | ErrorResponse> {
        
        if (this._functionName === undefined) throw new Error('this._functionName === undefined');

        const requestId = uuid.v4();

        const message: AsyncRequestMessage = 
            {
                callingContext: {
                    requestId: requestId,
                    flowInstanceId: flowContext.instanceId,
                    flowCorrelationId: flowContext.correlationId,
                    flowTypeName: flowContext.rootStackFrame.flowTypeName
                },
                request: request
            };

        const invocationRequest: Lambda.Types.InvocationRequest = {
            FunctionName: this._functionName,
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify(message)            
        };

        const lambda = new Lambda();

        const invokeResult = await lambda.invoke(invocationRequest).promise();

        console.log(`invokeResult: ${JSON.stringify(invokeResult)}`);

        if (invokeResult.FunctionError !== undefined) {
            // TODO 05May20: Should we log the error here or do something more? 
            throw new Error(invokeResult.FunctionError);            
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
            // TODO 05May20: What details should we use to throw here?
            throw new Error(response.message);
        }

        return response;
    }
}
