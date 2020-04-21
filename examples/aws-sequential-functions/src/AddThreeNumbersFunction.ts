import AWS from 'aws-sdk';
import { SNSEvent } from 'aws-lambda';

import { FlowHandlers } from './omahdog/FlowHandlers';
import { SNSActivityRequestHandler } from './omahdog-aws/SNSActivityRequestHandler';

import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { InMemoryInstanceRepository, flowHandler } from './omahdog-aws/AWSUtils';

import { AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';

const sns = new AWS.SNS();

const flowExchangeTopic = process.env.FLOW_EXCHANGE_TOPIC_ARN;

const flowHandlers = new FlowHandlers()
    .register(SumNumbersRequest, SumNumbersResponse, 
        new SNSActivityRequestHandler<SumNumbersRequest, SumNumbersResponse>(
            AddThreeNumbersHandler, SumNumbersRequest, sns, flowExchangeTopic));

const functionInstanceRepository = new InMemoryInstanceRepository();

export const handler = async (event: SNSEvent): Promise<void> => {
    await flowHandler<AddThreeNumbersResponse>(
        event, new AddThreeNumbersHandler(), flowHandlers, flowExchangeTopic, functionInstanceRepository, sns);
};
