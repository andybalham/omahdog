import AWS from 'aws-sdk';
import { SNSEvent, APIGatewayEvent } from 'aws-lambda';

import { FlowContext } from './omahdog/FlowContext';
import { FlowHandlers } from './omahdog/FlowHandlers';
import { SNSActivityRequestHandler } from './omahdog-aws/SNSActivityRequestHandler';
import { getEventRequest, isSNSRequest } from './omahdog-aws/AWSUtils';

import { AddThreeNumbersRequest } from './exchanges/AddThreeNumbersExchange';
import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { IFlowInstanceRepository } from './omahdog/FlowInstanceRepository';

const sns = new AWS.SNS();

const handlers = new FlowHandlers()
    .register(SumNumbersRequest, SumNumbersResponse, 
        new SNSActivityRequestHandler<SumNumbersRequest, SumNumbersResponse>(
            SumNumbersRequest, sns, process.env.FLOW_EXCHANGE_TOPIC_ARN));

class InMemoryInstanceRepository implements IFlowInstanceRepository {

    private readonly _mapRepository = new Map<string, import('./omahdog/FlowContext').FlowInstanceStackFrame[]>();

    upsert(instanceId: string, stackFrames: import('./omahdog/FlowContext').FlowInstanceStackFrame[]): Promise<void> {
        // TODO 16Apr20: How can we store the request id? It is on the flowContext. Should we pass it in here?
        this._mapRepository.set(instanceId, stackFrames);
        return Promise.resolve();
    }
    
    retrieve(instanceId: string): Promise<import('./omahdog/FlowContext').FlowInstanceStackFrame[]> {
        throw new Error('Method not implemented.');
    }
    
    delete(instanceId: string): Promise<void> {
        throw new Error('Method not implemented.');
    }
}   

const instanceRepository = new InMemoryInstanceRepository();

export const handler = async (event: SNSEvent | APIGatewayEvent): Promise<void> => {

    // TODO 17Apr20: Allow for event to be the request itself
    
    console.log(`event: ${JSON.stringify(event)}`);

    // TODO 16Apr20: Need to recognise when there is a response
    // We need to obtain the instanceId, asyncResponse01

    if ('Records' in event) {
        
        const snsMessage = event.Records[0].Sns;

        const isRequest = isSNSRequest(snsMessage);

        // TODO 16Apr20: We will assume that it is always be a request from API Gateway.
    }

    const request = getEventRequest<AddThreeNumbersRequest>(event);

    console.log(`request: ${JSON.stringify(request)}`);

    const flowContext = new FlowContext(instanceRepository);
    flowContext.handlers = handlers;

    const response = await new AddThreeNumbersHandler().handle(flowContext, request);

    console.log(`response: ${JSON.stringify(response)}`);

    if ('Records' in event) {
        
        // TODO 16Apr20: Send back a response via the appropriate topic (response could be undefined)

    } else if ('httpMethod' in event) {
        
        // TODO 16Apr20: Send back a response via HTTP (response could be undefined)

    }
};

