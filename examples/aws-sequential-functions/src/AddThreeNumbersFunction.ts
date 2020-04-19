import AWS, { HttpResponse } from 'aws-sdk';
import { SNSEvent, APIGatewayEvent } from 'aws-lambda';

import { FlowContext } from './omahdog/FlowContext';
import { FlowHandlers, AsyncResponse } from './omahdog/FlowHandlers';
import { SNSActivityRequestHandler, AsyncResponseMessage } from './omahdog-aws/SNSActivityRequestHandler';
import { getEventContent } from './omahdog-aws/AWSUtils';

import { AddThreeNumbersRequest, AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { IFlowInstanceRepository, FlowInstance } from './omahdog/FlowInstanceRepository';
import { PublishInput } from 'aws-sdk/clients/sns';

const sns = new AWS.SNS();

const handlers = new FlowHandlers()
    .register(SumNumbersRequest, SumNumbersResponse, 
        new SNSActivityRequestHandler<SumNumbersRequest, SumNumbersResponse>(
            AddThreeNumbersHandler, SumNumbersRequest, sns, process.env.FLOW_EXCHANGE_TOPIC_ARN));

class InMemoryInstanceRepository implements IFlowInstanceRepository {

    private readonly _mapRepository = new Map<string, FlowInstance>();

    create(flowInstance: FlowInstance): Promise<void> {
        this._mapRepository.set(flowInstance.asyncRequestId, flowInstance);
        return Promise.resolve();
    }
    
    retrieve(asyncRequestId: string): Promise<FlowInstance> {
        throw new Error('Method not implemented.');
    }
    
    delete(asyncRequestId: string): Promise<void> {
        throw new Error('Method not implemented.');
    }
}   

const instanceRepository = new InMemoryInstanceRepository();

export const handler = async (event: AddThreeNumbersRequest | SNSEvent | APIGatewayEvent ): 
        Promise<AddThreeNumbersResponse | AsyncResponse | void | HttpResponse> => {

    console.log(`event: ${JSON.stringify(event)}`);

    const eventContent = getEventContent<AddThreeNumbersRequest>(event);

    console.log(`eventContent: ${JSON.stringify(eventContent)}`);

    let flowContext: FlowContext;
    let request: AddThreeNumbersRequest | undefined;

    if ('request' in eventContent) {
        
        // Async request
        flowContext = new FlowContext(instanceRepository);
        request = (eventContent.request as AddThreeNumbersRequest);

    }
    else if ('response' in eventContent) {

        // Resume
        
        const flowInstance = await instanceRepository.retrieve(eventContent.context.requestId);

        if (flowInstance === undefined) throw new Error(`No flowInstance found for requestId: ${eventContent.context.requestId}`);
        
        flowContext = new FlowContext(instanceRepository, flowInstance, eventContent.response);
        request = undefined;

    } else {

        // Request
        flowContext = new FlowContext(instanceRepository);
        request = (eventContent as AddThreeNumbersRequest);

    }

    flowContext.handlers = handlers;
    
    const response = await new AddThreeNumbersHandler().handle(flowContext, request);
    
    // TODO 19Apr20: If we have an async response, we need to store the callback details
    // TODO 19Apr20: This means that even direct calls need be made as though they are async
    // TODO 19Apr20: We need to throw an error if we have an async response, but no callback details

    console.log(`response: ${JSON.stringify(response)}`);

    if ('request' in eventContent) {
        
        // Was an async request

        const message: AsyncResponseMessage = 
            {
                context: {
                    requestId: eventContent.context.requestId,
                    flowInstanceId: eventContent.context.flowInstanceId,                    
                },
                response: response
            };

        const params: PublishInput = {
            Message: JSON.stringify(message),
            TopicArn: 'TODO', // TODO 19Apr20: How do we get the topic ARN here
            MessageAttributes: {
                MessageType: { DataType: 'String', StringValue: `${eventContent.context.flowTypeName}:Response` }
            }
        };
        
        const publishResponse = await sns.publish(params).promise();
    
        console.log(`publishResponse.MessageId: ${publishResponse.MessageId}`);

        return;
    }
    else {

        // Was a request or a resume

        if ('Records' in event) {
            // SNS
            return;
        }
        else if ('httpMethod' in event) {
            // HTTP
            const httpResponse = new HttpResponse();
            httpResponse.statusCode = 200; // TODO 19Apr20: Allow for alternative HTTP status codes, this may depend on the response itself
            httpResponse.body = JSON.stringify(response);
            return httpResponse;
        }
        else {
            // Direct
            return response;
        }
            
    }
};

