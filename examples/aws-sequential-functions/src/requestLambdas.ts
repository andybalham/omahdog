import { SNSEvent } from 'aws-lambda';

import { DeadLetterQueueHandler } from './omahdog-aws/DeadLetterQueueHandler';

import { exchangeMessagePublisher } from './lambdaApplication';
import { LambdaExchangeWireTap } from './omahdog-aws/LambdaExchangeWireTap';

const deadLetterQueueHandlerInstance = new DeadLetterQueueHandler(exchangeMessagePublisher);
export const deadLetterQueueHandler = async (event: SNSEvent): Promise<void> => {
    await deadLetterQueueHandlerInstance.handle(event);
};

const exchangeWireTapLambda = new LambdaExchangeWireTap();
export const exchangeWireTapHandler = async (event: SNSEvent): Promise<void> => {
    await exchangeWireTapLambda.handle(event);
};

