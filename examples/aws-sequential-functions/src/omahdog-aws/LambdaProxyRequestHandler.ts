import { Lambda } from 'aws-sdk';
import uuid = require('uuid');
import { FlowContext, IActivityRequestHandler, AsyncResponse } from '../omahdog/FlowContext';
import { ErrorResponse } from '../omahdog/FlowExchanges';
import { ExchangeRequestMessage, ExchangeResponseMessage } from './Exchange';
import { LambdaInvokeResource } from './AwsResources';

export class LambdaProxyRequestHandler<TReq, TRes> implements IActivityRequestHandler<TReq, TRes> {
    
    resources = {
        proxy: new LambdaInvokeResource
    }    

    async handle(flowContext: FlowContext, request: TReq): Promise<TRes | AsyncResponse | ErrorResponse> {
        
        const functionName = this.resources.proxy.functionName;

        console.log(`Lambda proxy for ${functionName?.value} called with: ${JSON.stringify(request)}`);
        
        if (functionName?.value === undefined) throw new Error('this.resources.lambda.functionName.value === undefined');
        if (this.resources.proxy.lambda === undefined) throw new Error('this.resources.lambda.client === undefined');

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
            FunctionName: functionName.value,
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify(message)            
        };

        let invokeResult;
        try {
            console.log(`invocationRequest: ${JSON.stringify(invocationRequest)}`);
            invokeResult = await this.resources.proxy.lambda.invoke(invocationRequest).promise();
            console.log(`invokeResult: ${JSON.stringify(invokeResult)}`);
        } catch (error) {
            console.error('Error calling lambda.invoke: ' + error.message);
            throw new Error('Error calling lambda.invoke');
        }

        if (invokeResult.FunctionError !== undefined) {
            console.error(`Error invoking function ${functionName.value}: ${JSON.stringify(invokeResult)}`);
            throw new Error(`Error invoking function ${functionName.value}`);
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
            console.error(`ErrorResponse received from ${functionName.value}: ${JSON.stringify(response)}`);
            throw new Error(`ErrorResponse received from ${functionName.value}`);
        }

        return response;
    }
}
