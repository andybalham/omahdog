import { Lambda } from 'aws-sdk';
import uuid = require('uuid');
import { FlowContext, IActivityRequestHandler, AsyncResponse } from '../omahdog/FlowContext';
import { ErrorResponse } from '../omahdog/FlowExchanges';
import { ExchangeRequestMessage, ExchangeResponseMessage } from './Exchange';

export class ActivityRequestLambdaProxy<TReq, TRes> implements IActivityRequestHandler<TReq, TRes> {
    
    readonly functionName?: string;

    constructor(functionName?: string) {
        this.functionName = functionName;
    }

    async handle(flowContext: FlowContext, request: TReq): Promise<TRes | AsyncResponse | ErrorResponse> {
        
        console.log(`Lambda proxy for ${this.functionName} called with: ${JSON.stringify(request)}`);
        
        if (this.functionName === undefined) throw new Error('this.functionName === undefined');

        const requestId = uuid.v4();

        const message: ExchangeRequestMessage = 
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

        let invokeResult;
        try {
            console.log(`invocationRequest: ${JSON.stringify(invocationRequest)}`);
            invokeResult = await lambda.invoke(invocationRequest).promise();
            console.log(`invokeResult: ${JSON.stringify(invokeResult)}`);
        } catch (error) {
            console.error('Error calling lambda.invoke: ' + error.message);
            throw new Error('Error calling lambda.invoke');
        }

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

        const responseMessage: ExchangeResponseMessage = JSON.parse(invokeResult.Payload);

        const response: TRes | AsyncResponse | ErrorResponse = responseMessage.response;

        if ('ErrorResponse' in response) {
            console.error(`ErrorResponse received from ${this.functionName}: ${JSON.stringify(response)}`);
            throw new Error(`ErrorResponse received from ${this.functionName}`);
        }

        return response;
    }
}
