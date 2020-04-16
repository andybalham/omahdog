import AWS from 'aws-sdk';
import { SNSEvent, APIGatewayEvent } from 'aws-lambda';

import { FlowContext } from './omahdog/FlowContext';
import { FlowHandlers } from './omahdog/FlowHandlers';
import { SNSActivityRequestHandler } from './omahdog-aws/SNSActivityRequestHandler';
import { getEventRequest } from './omahdog-aws/AWSUtils';

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

    console.log(`event: ${JSON.stringify(event)}`);

    // TODO 16Apr20: Need to recognise when this is a response
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

