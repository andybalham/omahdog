import { SNSEvent } from 'aws-lambda';

import { LambdaActivityRequestHandler } from './omahdog-aws/LambdaActivityRequestHandler';

import { requestRouter, flowExchangeTopic, functionInstanceRepository, handlerFactory } from './FunctionsCommon';

import { SumNumbersResponse, SumNumbersRequest } from './exchanges/SumNumbersExchange';

const activityRequestHandler = 
    new LambdaActivityRequestHandler(SumNumbersRequest, requestRouter, handlerFactory, flowExchangeTopic, functionInstanceRepository);

export const handler = async (event: SNSEvent): Promise<void> => {
    await activityRequestHandler.handle<SumNumbersResponse>(event);
};
