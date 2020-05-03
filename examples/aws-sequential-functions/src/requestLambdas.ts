import SNS from 'aws-sdk/clients/sns';
import { SNSEvent } from 'aws-lambda';

import { LambdaActivityRequestHandler } from './omahdog-aws/LambdaActivityRequestHandler';
import { requestRouter, handlerFactory, functionInstanceRepository, exchangeMessagePublisher } from './requestLambdaCommon';

import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';
import { StoreTotalHandler } from './handlers/StoreTotalHandler';

const lambdaActivityRequestHandler = 
    new LambdaActivityRequestHandler(
        requestRouter, handlerFactory, exchangeMessagePublisher, functionInstanceRepository);

export const addThreeNumbersHandler = async (event: SNSEvent): Promise<void> => {
    await lambdaActivityRequestHandler.handle(AddThreeNumbersHandler, event);
};

export const sumNumbersHandler = async (event: SNSEvent): Promise<void> => {
    await lambdaActivityRequestHandler.handle(SumNumbersHandler, event);
};

export const storeTotalHandler = async (event: SNSEvent): Promise<void> => {
    await lambdaActivityRequestHandler.handle(StoreTotalHandler, event);
};
