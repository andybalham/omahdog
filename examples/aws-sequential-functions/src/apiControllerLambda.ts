import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AsyncRequestMessage, AsyncResponseMessage } from './omahdog-aws/AsyncExchange';
import { FlowContext, AsyncResponse, IActivityRequestHandlerBase } from './omahdog/FlowContext';
import { requestRouter, handlerFactory, AddThreeNumbersHandlerLambdaProxy, AddThreeNumbersHandlerMessageProxy } from './requestConfiguration';
import { AddThreeNumbersRequest, AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { FlowRequestHandler } from './omahdog/FlowRequestHandler';
import { FlowBuilder } from './omahdog/FlowBuilder';
import { FlowDefinition } from './omahdog/FlowDefinition';
import { ErrorResponse } from './omahdog/FlowExchanges';
import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';

// TODO 01May20: Package this up as a class for easy use in a host application

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {

    try {
        
        console.log(`event: ${JSON.stringify(event)}`);

        if (event.httpMethod !== 'POST') throw new Error(`Unhandled HTTP method: ${event.httpMethod}`);
        if (event.body === null) throw new Error('Request body was null');

        const functionName = event.pathParameters?.functionName;
        const invocationMethod = event.pathParameters?.invocationMethod;

        if (functionName === undefined) throw new Error('functionName === undefined');
        if (invocationMethod === undefined) throw new Error('invocationMethod === undefined');
        
        const flowContext = FlowContext.newContext(requestRouter, handlerFactory);
        
        const request: any = JSON.parse(event.body);
        let response: any;

        switch (functionName) {
        case 'add-three-numbers':
            response = await HandleAddThreeNumbersRequest(flowContext, invocationMethod, request);
            break;
        default:
            throw new Error(`Unhandled function: ${functionName}`);
        }

        return response;

    } catch (error) {
        console.error(`error.message: ${error.message}`);        
        console.error(`error.stack: ${error.stack}`);        

        return {
            statusCode: 500,
            body: `error.stack: ${error.stack}`
        };
    }
};

async function HandleAddThreeNumbersRequest(flowContext: FlowContext, invocationMethod: string, request: AddThreeNumbersRequest): 
    Promise<APIGatewayProxyResult> {

    let handlerType: new () => IActivityRequestHandlerBase;

    switch (invocationMethod) {
    case 'direct':
        handlerType = AddThreeNumbersHandler;
        break;        
    case 'lambda':
        handlerType = AddThreeNumbersHandlerLambdaProxy;
        break;        
    case 'sns':
        handlerType = AddThreeNumbersHandlerMessageProxy;
        break;            
    default:
        throw new Error(`Unhandled invocationMethod: ${invocationMethod}`);
    }
    
    const response: AddThreeNumbersResponse | AsyncResponse | ErrorResponse = 
        await flowContext.handleRequest(handlerType, request);   

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
}

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