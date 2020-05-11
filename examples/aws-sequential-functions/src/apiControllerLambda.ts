import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { FlowContext, AsyncResponse, IActivityRequestHandlerBase, RequestRouter } from './omahdog/FlowContext';
import { ErrorResponse } from './omahdog/FlowExchanges';
import { requestRouter, handlerFactory, AddThreeNumbersHandlerLambdaProxy, AddThreeNumbersHandlerMessageProxy, AddTwoNumbersHandlerLambdaProxy, AddTwoNumbersHandlerMessageProxy } from './requestConfiguration';
import { AddThreeNumbersRequest, AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { AddTwoNumbersResponse, AddTwoNumbersRequest } from './exchanges/AddTwoNumbersExchange';

// TODO 10May20: Think about how to package this up as a generic class

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {

    try {
        
        console.log(`event: ${JSON.stringify(event)}`);

        const functionName = event.pathParameters?.functionName;

        if (functionName === undefined) throw new Error('functionName === undefined');
        
        let request: any;
        if (event.httpMethod === 'GET') {

            if (event.queryStringParameters === null) throw new Error('event.queryStringParameters === null');

            request = {};
            for (const key in event.queryStringParameters) {
                const value = event.queryStringParameters[key];
                request[key] = parseInt(value);
            }

        } else {

            if (event.body === null) throw new Error('Request body was null');
        
            request = JSON.parse(event.body);
        }

        console.log(`request: ${JSON.stringify(request)}`);

        const flowContext = FlowContext.newContext(requestRouter, handlerFactory);

        let response: any;

        switch (functionName) {
        case 'add-two-numbers':
            response = await HandleAddTwoNumbersRequest(flowContext, event.httpMethod, request);
            break;
        case 'add-three-numbers':
            response = await HandleAddThreeNumbersRequest(flowContext, event.httpMethod, request);
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

async function HandleAddThreeNumbersRequest(flowContext: FlowContext, httpMethod: string, request: AddThreeNumbersRequest): 
    Promise<APIGatewayProxyResult> {

    let handlerType: new () => IActivityRequestHandlerBase;

    switch (httpMethod) {
    case 'GET':
        handlerType = AddThreeNumbersHandlerLambdaProxy;
        break;        
    case 'POST':
        handlerType = AddThreeNumbersHandlerMessageProxy;
        break;            
    default:
        throw new Error(`Unhandled invocationMethod: ${httpMethod}`);
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

async function HandleAddTwoNumbersRequest(flowContext: FlowContext, httpMethod: string, request: AddTwoNumbersRequest): 
    Promise<APIGatewayProxyResult> {

    let handlerType: new () => IActivityRequestHandlerBase;

    switch (httpMethod) {
    case 'GET':
        handlerType = AddTwoNumbersHandlerLambdaProxy;
        break;        
    case 'POST':
        handlerType = AddTwoNumbersHandlerMessageProxy;
        break;            
    default:
        throw new Error(`Unhandled invocationMethod: ${httpMethod}`);
    }
    
    const response: AddTwoNumbersResponse | AsyncResponse | ErrorResponse = 
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
