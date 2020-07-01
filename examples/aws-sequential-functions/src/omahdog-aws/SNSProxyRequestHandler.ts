import uuid = require('uuid');
import { FlowContext, IActivityRequestHandler, AsyncResponse } from '../omahdog/FlowContext';
import { ExchangeRequestMessage } from './Exchange';
import { SNSExchangeMessagePublisher } from './SNSExchangeMessagePublisher';

export class SNSProxyRequestHandler<TReq, TRes> implements IActivityRequestHandler<TReq, TRes> {

    isAsync = true;

    services = {
        requestPublisher: new SNSExchangeMessagePublisher
    }

    private readonly requestTypeName: string;

    constructor(requestType: new() => TReq) {
        this.requestTypeName = requestType.name;
    }

    getEvents(rootHandlerTypeName: string): any[] {

        const responseEvent = {
            Type: 'SNS',
            Properties: {
                Topic: undefined,
                FilterPolicy: {
                    MessageType: new Array<string>()
                }
            },
        };

        responseEvent.Properties.Topic = this.services?.requestPublisher.services.exchangeTopic.parameters.topicArnValue?.getTemplateValue();
        responseEvent.Properties.FilterPolicy.MessageType = [`${rootHandlerTypeName}:Response`];

        return [responseEvent];
    }

    async handle(flowContext: FlowContext, request: TReq): Promise<TRes | AsyncResponse> {
        
        const requestId = uuid.v4();
        
        const message: ExchangeRequestMessage = 
            {
                callingContext: {
                    requestId: requestId,
                    flowInstanceId: flowContext.instanceId,
                    flowCorrelationId: flowContext.correlationId,
                    handlerTypeName: flowContext.rootHandlerTypeName
                },
                request: request
            };

        await this.services.requestPublisher.publishRequest(this.requestTypeName, message);

        return flowContext.getAsyncResponse(requestId);
    }
}
