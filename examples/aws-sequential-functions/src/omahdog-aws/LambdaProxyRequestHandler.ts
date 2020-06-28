import { Lambda } from 'aws-sdk';
import uuid = require('uuid');
import { FlowContext, IActivityRequestHandler, AsyncResponse } from '../omahdog/FlowContext';
import { ErrorResponse } from '../omahdog/FlowExchanges';
import { ExchangeRequestMessage, ExchangeResponseMessage } from './Exchange';
import { LambdaInvokeService } from './AwsServices';

export class LambdaProxyRequestHandler<TReq, TRes> implements IActivityRequestHandler<TReq, TRes> {
    
    services = {
        lambda: new LambdaInvokeService
    }    

    async handle(flowContext: FlowContext, request: TReq): Promise<TRes | AsyncResponse | ErrorResponse> {
        
        const functionName = this.services.lambda.functionName;

        console.log(`Lambda proxy for ${functionName} called with: ${JSON.stringify(request)}`);

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
            FunctionName: functionName ?? '<Unknown>',
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify(message)            
        };

        let invokeResult;
        try {
            
            console.log(`invocationRequest: ${JSON.stringify(invocationRequest)}`);
            
            if (this.services.lambda.client === undefined) throw new Error('this.services.lambda.client === undefined');

            invokeResult = await this.services.lambda.client.invoke(invocationRequest).promise();
            
            console.log(`invokeResult: ${JSON.stringify(invokeResult)}`);

        } catch (error) {
            console.error('Error calling fn.invoke: ' + error.message);
            throw new Error('Error calling fn.invoke');
        }

        if (invokeResult?.FunctionError !== undefined) {
            console.error(`Error invoking function ${functionName}: ${JSON.stringify(invokeResult)}`);
            throw new Error(`Error invoking function ${functionName}`);
        }

        if (typeof invokeResult?.Payload === undefined) {
            return flowContext.getAsyncResponse(requestId);
        }

        if (typeof invokeResult?.Payload !== 'string') {
            throw new Error('typeof invokeResult.Payload !== \'string\'');
        }

        const responseMessage: ExchangeResponseMessage = JSON.parse(invokeResult.Payload);

        const response: TRes | AsyncResponse | ErrorResponse = responseMessage.response;

        if ('ErrorResponse' in response) {
            console.error(`ErrorResponse received from ${functionName}: ${JSON.stringify(response)}`);
            throw new Error(`ErrorResponse received from ${functionName}`);
        }

        return response;
    }
}
