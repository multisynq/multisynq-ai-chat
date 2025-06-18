# Multisynq AI Chat

This is an example of an LLM as a participant in a Multisynq session. More generally, it illustrates how to use any external service with Multisynq's fully client-side architecture.

Try it at https://multisynq.github.io/multisynq-ai-chat then visit the randomly generated session URL from another browser window or device.

## Electing a View

The synchronized Multisynq Model cannot directly talk to external services since it must run completely deterministically. Instead, it elects one of the participating Views to relay its requests.

This uses a simple Model subclass `Elected` which tracks joining and exiting views, and assigns one of the `viewIds` to be the `electedViewId`.

The `AIRelayModel` class is a subclass of `Elected` that keeps a list of pending requests, and publishes the requests as they come in.

The elected `AIRelayView` then forwards the request to the external service (an AI worker in this case) and publishes the response back to the Model, which adds it to the chat history.

## Event flow

The flow of events is this:

1. one user types a message, hits send
   * their ChatView publishes it as "input:newPost"
2. all ChatModels receive "input:newPost", execute `newPost()`
   * call AIRelayModel's `relayRequest()`
     - sets up a `resolve()` callback
     - publishes "[id]:relay-request"
   * calls its own `addToHistory()` with the user's message
     - publishes "history:update"
3. all AIRelayViews receive "[id]:relay-request", execute `relayRequest()`
   * only the elected view acts on it
   * sends request to AI service
4. all ChatViews receive "history:update", execute `refreshHistory()`
   * display the history, including the user's message
5. the elected AIRelayView gets the response from AI service
   * publishes "[id]:relay-response"
6. all AIRelayModels receive "[id]:relay-response", execute `relayResponse()`
   * calls the request's `resolve()` callback in `newPost()`
     - which calls `addToHistory()` with the AI's message
        * publishes "history:update"
7. all ChatViews receive "history:update", execute `refreshHistory()`
   * display the history, including the AI's message

Herein, "all" refers to the computations on each user's device in the shared session. All models are acting identically, whereas the views might not.

This flow ensures that only one of the participants sends the external request to the AI service, even though every model simultaneously publishes that request. Only the elected view acts on it. In contrast, all views respond identically to the history update event. The desired behavior depends on the use case.

## Chat AI

The example uses Meta's "llama-3.1-8b-instruct-fast" model via a [Cloudflare AI worker](https://github.com/multisynq/multisynq-ai-worker). The system prompt includes a list of current users in the chat room, as well as the last 20 chat history entries for context. Whenever a user writes something, that prompt with context is sent to the service, and the response is relayed to the chat.

The communication of the elected view with the service is encrypted by HTTPS, and the communication between the chat participants is end-to-end encrypted with a random session password passed in the URL, as is typical for Multisynq apps.