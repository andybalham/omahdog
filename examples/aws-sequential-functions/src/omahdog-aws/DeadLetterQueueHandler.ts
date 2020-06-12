import { SNSEvent } from 'aws-lambda';
import { ExchangeRequestMessage, ExchangeResponseMessage } from './Exchange';
import { ErrorResponse } from '../omahdog/FlowExchanges';
import { IExchangeMessagePublisher } from './ExchangeMessagePublisher';

export class DeadLetterQueueHandler {
    
    private readonly _exchangeMessagePublisher: IExchangeMessagePublisher;

    constructor (exchangeMessagePublisher: IExchangeMessagePublisher) {
        this._exchangeMessagePublisher = exchangeMessagePublisher;
    }

    async handle(event: SNSEvent): Promise<void> {

        try {

            const snsMessage = event.Records[0].Sns;
    
            console.log(JSON.stringify(snsMessage));
        
            const deadEvent: SNSEvent = JSON.parse(snsMessage.Message);
    
            const deadSnsMessage = deadEvent.Records[0].Sns;
    
            const deadMessage: ExchangeRequestMessage | ExchangeResponseMessage = JSON.parse(deadSnsMessage.Message);
    
            if ('request' in deadMessage) {
    
                const logEntry = {
                    MessageAttributes: deadSnsMessage.MessageAttributes,
                    MessageContext: deadMessage.callingContext,
                    Request: deadMessage.request
                };
        
                console.log(JSON.stringify(logEntry));
    
                const callingContext = deadMessage.callingContext;
    
                const response: ErrorResponse = {
                    ErrorResponse: true,
                    name: 'Error',
                    message: snsMessage.MessageAttributes.ErrorMessage.Value
                };
    
                const responseMessage: ExchangeResponseMessage = 
                    {
                        callingContext: callingContext,
                        response: response
                    };
        
                await this._exchangeMessagePublisher.publishResponse(callingContext.handlerTypeName, responseMessage);
        
            } else if ('response' in deadMessage) {
    
                // TODO 03May20: Do something more with the dead response

                const logEntry = {
                    MessageAttributes: deadSnsMessage.MessageAttributes,
                    MessageContext: deadMessage.callingContext,
                    Response: deadMessage.response
                };
        
                console.log(JSON.stringify(logEntry));
    
            } else {
    
                console.error(JSON.stringify(deadSnsMessage));
    
            }
            
        } catch (error) {
            console.error(`error.message: ${error.message}`);        
            console.error(`error.stack: ${error.stack}`);        
        }
    }
}
