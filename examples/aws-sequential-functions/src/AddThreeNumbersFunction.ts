import AWS from 'aws-sdk';
import { SNSEvent } from 'aws-lambda';

import { FlowHandlers } from './omahdog/FlowHandlers';

import { SNSActivityRequestHandler } from './omahdog-aws/SNSActivityRequestHandler';
import { LambdaActivityRequestHandler, DynamoDbFunctionInstanceRepository } from './omahdog-aws/LambdaActivityRequestHandler';

import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';

// TODO 24Apr20: Move the following to a common module
const sns = new AWS.SNS();
const flowExchangeTopic = process.env.FLOW_EXCHANGE_TOPIC_ARN;
const functionInstanceRepository = new DynamoDbFunctionInstanceRepository(process.env.FLOW_INSTANCE_TABLE_NAME);

// TODO 24Apr20: How can we have a central container for the handlers?
const flowHandlers = new FlowHandlers()
    .register(SumNumbersRequest, SumNumbersResponse, 
        new SNSActivityRequestHandler<SumNumbersRequest, SumNumbersResponse>(
            AddThreeNumbersHandler, SumNumbersRequest, sns, flowExchangeTopic));

const activityRequestHandler = 
    new LambdaActivityRequestHandler(
        new AddThreeNumbersHandler(), flowHandlers, flowExchangeTopic, functionInstanceRepository, sns);

export const handler = async (event: SNSEvent): Promise<void> => {
    await activityRequestHandler.handle<AddThreeNumbersResponse>(event);
};
