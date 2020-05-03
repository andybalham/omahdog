import { SNSActivityRequestHandler } from './omahdog-aws/SNSActivityRequestHandler';

import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { StoreTotalRequest, StoreTotalResponse } from './exchanges/StoreTotalExchange';
import { IExchangeMessagePublisher } from './omahdog-aws/IExchangeMessagePublisher';

export class SumNumbersSNSHandler extends SNSActivityRequestHandler<SumNumbersRequest, SumNumbersResponse> {
    constructor(exchangeMessagePublisher?: IExchangeMessagePublisher) { 
        super(SumNumbersRequest, SumNumbersResponse, exchangeMessagePublisher); 
    }
}

export class StoreTotalSNSHandler extends SNSActivityRequestHandler<StoreTotalRequest, StoreTotalResponse> {
    constructor(exchangeMessagePublisher?: IExchangeMessagePublisher) { 
        super(StoreTotalRequest, StoreTotalResponse, exchangeMessagePublisher); 
    }
}
