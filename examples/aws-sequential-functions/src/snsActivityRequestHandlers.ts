import SNS from 'aws-sdk/clients/sns';

import { SNSActivityRequestHandler } from './omahdog-aws/SNSActivityRequestHandler';

import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { StoreTotalRequest, StoreTotalResponse } from './exchanges/StoreTotalExchange';

export class SumNumbersSNSHandler extends SNSActivityRequestHandler<SumNumbersRequest, SumNumbersResponse> {
    constructor(sns?: SNS, topicArn?: string) { super(SumNumbersRequest, SumNumbersResponse, sns, topicArn); }
}

export class StoreTotalSNSHandler extends SNSActivityRequestHandler<StoreTotalRequest, StoreTotalResponse> {
    constructor(sns?: SNS, topicArn?: string) { super(StoreTotalRequest, StoreTotalResponse, sns, topicArn); }
}
