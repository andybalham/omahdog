import { IExchangeMessagePublisher } from './omahdog-aws/IExchangeMessagePublisher';
import { ActivityRequestHandlerMessageProxy } from './omahdog-aws/ActivityRequestHandlerMessageProxy';

import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { StoreTotalRequest, StoreTotalResponse } from './exchanges/StoreTotalExchange';

export class SumNumbersHandlerMessageProxy extends ActivityRequestHandlerMessageProxy<SumNumbersRequest, SumNumbersResponse> {
    constructor(exchangeMessagePublisher?: IExchangeMessagePublisher) { 
        super(SumNumbersRequest, SumNumbersResponse, exchangeMessagePublisher); 
    }
}

export class StoreTotalHandlerMessageProxy extends ActivityRequestHandlerMessageProxy<StoreTotalRequest, StoreTotalResponse> {
    constructor(exchangeMessagePublisher?: IExchangeMessagePublisher) { 
        super(StoreTotalRequest, StoreTotalResponse, exchangeMessagePublisher); 
    }
}
