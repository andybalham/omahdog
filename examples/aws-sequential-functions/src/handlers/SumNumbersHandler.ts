import { IActivityRequestHandler } from '../omahdog/FlowHandlers';
import { FlowContext } from '../omahdog/FlowContext';
import { SumNumbersRequest as SumNumbersRequest, SumNumbersResponse as SumNumbersResponse } from '../exchanges/SumNumbersExchange';
import { SNSActivityRequestHandler } from '../omahdog-aws/SNSActivityRequestHandler';

export class SumNumbersHandler implements IActivityRequestHandler<SumNumbersRequest, SumNumbersResponse> {

    async handle(_flowContext: FlowContext, request: SumNumbersRequest): Promise<SumNumbersResponse> {
        const total = request.values.reduce((a, b) => a + b, 0);
        return { total: total };
    }
}

export class SumNumbersSNSHandler extends SNSActivityRequestHandler<SumNumbersRequest, SumNumbersResponse> {
    constructor(topicArn?: string) { super(SumNumbersRequest, SumNumbersResponse, topicArn); }
}
