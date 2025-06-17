# Multisynq AI Chat

This is an example of an LLM as a participant in a Multisynq session. More generally, it illustrates how to use any external service with Multisynq's fully client-side architecture.

Try it at https://multisynq.github.io/multisynq-ai-chat then visit the randomly generated session URL form another browser window or device.

## Electing a View

The synchronized Multisynq Model cannot directly talk to external services sinc eit must run completely deterministically. Instead, it elects one of the participating Views to relay its requests.

This uses a simple Model subclass `Elected` which tracks joining and exiting views, and assigns one of the `viewIds` to be the `electedViewId`.

The `AIRelayModel` class is a subclass of `Elected` that keeps a list of pending requests, and publishes the requests as they come in.

The elected `AIRelayView` then forwards the request to the external service (an AI worker in this case) and publishes the response back to the Model, which adds it to the chat history.

## Chat AI

The example uses Meta's "llama-3.1-8b-instruct-fast" model via a [Cloudflare AI worker](https://developers.cloudflare.com/workers-ai/). The system prompt includes a list of current users in the chat room, as well as the last 20 chat history entries for context. Whenever a user writes something, that prompt with context is sent to the service, and the response is relayed to the chat.

The communication of the elected view with the service is encrypted by HTTPS, and the communication between the chat participants is end-to-end encrypted with a random session password passed in the URL, as is typical for Multisynq apps.