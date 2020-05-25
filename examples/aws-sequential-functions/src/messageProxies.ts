import SNS from 'aws-sdk/clients/sns';

import { SNSExchangeMessagePublisher } from './omahdog-aws/SNSExchangeMessagePublisher';
import { SNSProxyRequestHandler } from './omahdog-aws/SNSProxyRequestHandler';

import { AddThreeNumbersRequest, AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { AddTwoNumbersRequest, AddTwoNumbersResponse } from './exchanges/AddTwoNumbersExchange';
import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { StoreTotalRequest, StoreTotalResponse } from './exchanges/StoreTotalExchange';

const sns = new SNS();
const exchangeMessagePublisher = new SNSExchangeMessagePublisher(sns, process.env.FLOW_EXCHANGE_TOPIC_ARN);

export class AddThreeNumbersMessageProxy extends SNSProxyRequestHandler<AddThreeNumbersRequest, AddThreeNumbersResponse> {
    constructor() { super(AddThreeNumbersRequest, AddThreeNumbersResponse, exchangeMessagePublisher); }
}

export class AddTwoNumbersMessageProxy extends SNSProxyRequestHandler<AddTwoNumbersRequest, AddTwoNumbersResponse> {
    constructor() { super(AddTwoNumbersRequest, AddTwoNumbersResponse, exchangeMessagePublisher); }
}

export class SumNumbersMessageProxy extends SNSProxyRequestHandler<SumNumbersRequest, SumNumbersResponse> {
    constructor() { super(SumNumbersRequest, SumNumbersResponse, exchangeMessagePublisher); }
}

export class StoreTotalMessageProxy extends SNSProxyRequestHandler<StoreTotalRequest, StoreTotalResponse> {
    constructor() { super(StoreTotalRequest, StoreTotalResponse, exchangeMessagePublisher); }
}
