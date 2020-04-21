import AWS from 'aws-sdk';
import { SNSEvent } from 'aws-lambda';

import { FlowHandlers } from './omahdog/FlowHandlers';
import { InMemoryInstanceRepository, flowHandler } from './omahdog-aws/AWSUtils';

import { SumNumbersHandler } from './handlers/SumNumbersHandler';
import { SumNumbersResponse } from './exchanges/SumNumbersExchange';

const sns = new AWS.SNS();

const flowExchangeTopic = process.env.FLOW_EXCHANGE_TOPIC_ARN;

const flowHandlers = new FlowHandlers();

const functionInstanceRepository = new InMemoryInstanceRepository();

export const handler = async (event: SNSEvent): Promise<void> => {
    await flowHandler<SumNumbersResponse>(
        event, new SumNumbersHandler(), flowHandlers, flowExchangeTopic, functionInstanceRepository, sns);
};
