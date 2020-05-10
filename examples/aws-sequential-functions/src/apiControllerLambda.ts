import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AsyncRequestMessage, AsyncResponseMessage } from './omahdog-aws/AsyncExchange';
import { FlowContext, AsyncResponse } from './omahdog/FlowContext';
import { requestRouter, handlerFactory, AddThreeNumbersHandlerLambdaProxy, AddThreeNumbersHandlerMessageProxy } from './requestConfiguration';
import { AddThreeNumbersRequest, AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { FlowRequestHandler } from './omahdog/FlowRequestHandler';
import { FlowBuilder } from './omahdog/FlowBuilder';
import { FlowDefinition } from './omahdog/FlowDefinition';
import { ErrorResponse } from './omahdog/FlowExchanges';

// TODO 01May20: Package this up as a class for easy use in a host application

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {

    try {
        
        console.log(`event: ${JSON.stringify(event)}`);

        if (event.httpMethod !== 'POST') throw new Error(`Unhandled HTTP method: ${event.httpMethod}`);

        if (event.body === null) throw new Error('Request body was null');

        const request = JSON.parse(event.body);
    
        const flowContext = FlowContext.newContext();
        // TODO 08May20: Would we want a different routing for the controller?
        flowContext.requestRouter = requestRouter;
        flowContext.handlerFactory = handlerFactory;

        let response: AddThreeNumbersResponse | AsyncResponse | ErrorResponse;

        switch (event.path) {
        case '/add-three-numbers/direct':
            response = await flowContext.sendRequest(AddThreeNumbersRequest, request);                
            break;        
        case '/add-three-numbers/lambda':
            response = await flowContext.handleRequest(AddThreeNumbersHandlerLambdaProxy, request);                
            break;        
        case '/add-three-numbers/sns':
            response = await flowContext.handleRequest(AddThreeNumbersHandlerMessageProxy, request);                
            break;            
        default:
            throw new Error(`Unhandled path: ${event.path}`);
        }
        
        if ('AsyncResponse' in response) {
            return {
                statusCode: 201,
                body: JSON.stringify({ requestId: response.requestId })
            };    
        }
        
        if ('ErrorResponse' in response) {
            return {
                statusCode: 500,
                body: JSON.stringify(response)
            };    
        }

        return {
            // TODO 10May20: The status code here could well depend on the response
            statusCode: 200,
            body: JSON.stringify(response)
        };    

    } catch (error) {
        console.error(`error.message: ${error.message}`);        
        console.error(`error.stack: ${error.stack}`);        

        return {
            statusCode: 500,
            body: `error.stack: ${error.stack}`
        };
    }
};

// TODO 09May20: Remove the code below

class RequestResponseState {
    request: AddThreeNumbersRequest;
    response: AddThreeNumbersResponse;
}

class RequestResponseFlowHandler extends FlowRequestHandler<AddThreeNumbersRequest, AddThreeNumbersResponse, RequestResponseState> {

    constructor () {
        super(RequestResponseFlowHandler, AddThreeNumbersResponse, RequestResponseState);
    }

    buildFlow(flowBuilder: FlowBuilder<AddThreeNumbersRequest, AddThreeNumbersResponse, RequestResponseState>): 
        FlowDefinition<AddThreeNumbersRequest, AddThreeNumbersResponse, RequestResponseState> {

        return flowBuilder
            .initialise((req, state) => {
                state.request = req;
            })
            .perform('Activity', AddThreeNumbersRequest, AddThreeNumbersResponse, 
                (req, state) => { req = state.request; }, // TODO 08May20: How to copy all properties?
                (res, state) => { state.response = res; })
            .finalise((res, state) => {
                res = state.response;
            });
    }
}