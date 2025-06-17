// AI Chat Example
//
// Croquet Labs, 2025
//
// This is an example of a simple chat application. It creates a chatroom where users can
// post messages to a shared conversation.

import * as Multisynq from "https://cdn.jsdelivr.net/npm/@multisynq/client@1.0.4/bundled/multisynq-client.esm.js";

//------------------------------------------------------------------------------------------
// ChatModel
//
// Keeps a list of connected users. Assigns a random name to each.
// When a post arrives from one of them, adds it to the chat history along with their name.
//------------------------------------------------------------------------------------------

class ChatModel extends Multisynq.Model {

    init() {
        this.users = {};
        this.history = [];
        this.subscribe("input", "newPost", this.newPost);
        this.subscribe("reset", "chatReset", this.chatReset);
        this.subscribe(this.sessionId, "view-join", this.userJoin);
        this.subscribe(this.sessionId, "view-exit", this.userDrop);

        AIRelayModel.create();
    }

    userJoin({viewId, viewData: {userName}}) {
        this.users[viewId] = userName;
        this.addToHistory(`<i>${userName} has entered the room</i>`);
    }

    userDrop({viewId}) {
        const userName = this.users[viewId];
        delete this.users[viewId];
        this.addToHistory(`<i>${userName} has exited the room</i>`);
   }

    newPost(post) {
        // send post to the AI relay
        const request = {
            users: Object.values(this.users), // send the list of users to the AI
            history: this.history.slice(-20), // send the last 20 messages to the AI
            text: post.text.trim(),
            // in a Model we can only store QFuncs, not regular functions
            // so we use a QFunc to handle the response
            resolve: this.createQFunc((response) => {
                this.addToHistory(`<b>AI:</b> ${this.escape(response.text)}`);
            }),
        };
        this.wellKnownModel("aiRelay").relayRequest(request);
        const userName = this.users[post.viewId];
        this.addToHistory(`<b>${userName}:</b> ${this.escape(post.text)}`);
    }

    addToHistory(item){
        this.history.push(item);
        if (this.history.length > 100) this.history.shift();
        this.publish("history", "update");
    }

    chatReset(viewId) {
        const userName = this.users[viewId];
        this.history = [];
        this.addToHistory(`<i>${userName} has reset the room</i>`);
   }

    escape(text) { // Clean up text to remove html formatting characters
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

}
ChatModel.register("ChatModel");

//------------------------------------------------------------------------------------------
// Elected
//
// Keeps track of an "elected" view that is responsible for certain actions.
//------------------------------------------------------------------------------------------

class Elected extends Multisynq.Model {
    init() {
        super.init();
        this.viewIds = new Set();
        this.electedViewId = "";
        this.subscribe(this.sessionId, "view-join", this.viewJoined);
        this.subscribe(this.sessionId, "view-exit", this.viewExited);
    }

    viewJoined({viewId}) {
        this.viewIds.add(viewId);
        this.viewsChanged();
    }

    viewExited({viewId}) {
        this.viewIds.delete(viewId);
        this.viewsChanged();
    }

    viewsChanged() {
        if (!this.viewIds.has(this.electedViewId)) {
            this.electedViewId = this.viewIds.values().next().value;
            this.viewElected(this.electedViewId);
        }
    }

    viewElected(viewId) {
        console.log(this.now(), "elected", this.electedViewId);
        this.publish(this.sessionId, "elected-view", viewId);
    }
}
Elected.register("Elected");

//------------------------------------------------------------------------------------------
// AIRelayModel
//
// Relays AI requests to the elected view.
//------------------------------------------------------------------------------------------

class AIRelayModel extends Elected {
    init() {
        super.init();
        this.beWellKnownAs("aiRelay");
        this.requestId = 0;
        this.pendingRequests = new Map();
        this.subscribe(this.id, "relay-response", this.relayResponse);
    }

    viewElected() {
        if (!this.electedViewId) return;
        // console.log(this.now(), "elected view", this.electedViewId);
        // relay pending requests to the newly elected view, if any
        for (const [requestId, request] of this.pendingRequests.entries()) {
            // console.log(this.now(), "relay request", this.electedViewId, requestId, request);
            this.publish(this.id, "relay-request", {
                electedViewId: this.electedViewId,
                requestId,
                request
            });
        }
    }

    relayRequest(request) {
        const requestId = ++this.requestId;
        this.pendingRequests.set(requestId, request);
        if (!this.electedViewId) {
            // console.log(this.now(), "no elected view, deferring request", requestId, request);
            return; // defer until we have an elected view
        }
        // if we have an elected view, relay the request immediately
        // console.log(this.now(), "relay request", this.electedViewId, requestId, request);
        this.publish(this.id, "relay-request", {
            electedViewId: this.electedViewId,
            requestId,
            request
        });
    }

    relayResponse(response) {
        // console.log(this.now(), "relay response", response);
        const request = this.pendingRequests.get(response.requestId);
        if (request) {
            this.pendingRequests.delete(response.requestId);
            if (request.resolve) {
                request.resolve(response);
            }
        }
    }
}
AIRelayModel.register("AIRelayModel");


//------------------------------------------------------------------------------------------
// ChatView
//
// Posts messages, and displays message history.
//------------------------------------------------------------------------------------------

class ChatView extends Multisynq.View {

    constructor(model) {
        super(model);
        this.model = model;
        const sendButton = document.getElementById("sendButton");
        sendButton.onclick = event => this.onSendClick(event);
        const resetButton = document.getElementById("resetButton");
        resetButton.onclick = event => this.onResetClick(event);
        this.subscribe("history", "update", this.refreshHistory);
        this.refreshHistory(model.history);

        this.aiRelayView = new AIRelayView(this.wellKnownModel("aiRelay"));
    }

    onSendClick() {
        const textIn = document.getElementById("textIn");
        const post = {viewId: this.viewId, text: textIn.value};
        this.publish("input", "newPost", post);
        textIn.value = "";
    }

    onResetClick() {
        this.publish("reset", "chatReset", this.viewId);
    }

    refreshHistory() {
        const textOut = document.getElementById("textOut");
        textOut.innerHTML =
            `<b>Welcome to Multisynq Chat, ${ThisUser}!</b><br>
            <i>AI is here, along with ${Object.values(this.model.users).join(", ")}</i><br><br>
            ${this.model.history.join("<br>")}`;
        textOut.scrollTop = textOut.scrollHeight;
    }

}


class AIRelayView extends Multisynq.View {

    constructor(model) {
        super(model);
        this.model = model;
        this.subscribe(model.id, "relay-request", this.relayRequest);
    }

    async relayRequest({electedViewId, requestId, request}) {
        if (electedViewId !== this.viewId) return; // only process requests if I'm the elected view
        console.log(electedViewId, "relaying AI request", requestId, request);

        const text = await this.processAIRequest(request);

        // If the elected view has changed while we were processing the request, ignore it
        if (this.model.electedViewId !== this.viewId) {
            console.log(this.viewId, "no longer elected, ignoring response", requestId);
            return;
        }

        console.log(electedViewId, "relaying AI response", requestId);
        const response = {
            requestId,
            text,
        };
        this.publish(this.model.id, "relay-response", response);
    }

    async processAIRequest({users, history, text}) {
        const body = JSON.stringify({
            run: {
                model: "@cf/meta/llama-3.1-8b-instruct-fast",
                options: {
                    messages: [
                        {
                            role: "system",
                            content:
`You are "AI", a friendly participant in a multiuser chat room.
You are expected to respond to user messages in a helpful and engaging manner.
You should not respond to system messages or your own messages (from user name "AI").
You should not use any HTML formatting in your responses.
You should not use any special formatting in your responses.
You should not use any markdown formatting in your responses.
There is no direct messaging in this chat room.
The users in the chat room are: ${users.join(", ")}.
This is the latest chat history:
${history.join("\n")}`
                        },
                        {
                            role: "user",
                            content: text
                        }
                    ],
                }
            }
        });
        try {
            const response = await fetch("https://ai-worker.synq.workers.dev", {
                method: "POST",
                body,
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log(this.viewId, "received AI response:", data);
            if (data.error) {
                throw new Error(`AI error: ${data.error}`);
            }
            return data.response || "Sorry, I didn't understand that.";
        } catch (error) {
            console.error("Error processing AI request:", error);
            return "Sorry, I couldn't process that request.";
        }
    }

}

//------------------------------------------------------------------------------------------
// Join the session and spawn our model and view.
//------------------------------------------------------------------------------------------

function randomName() {
    const names =["Acorn","Allspice","Almond","Ancho","Anise","Aoli","Apple","Apricot","Arrowroot","Asparagus","Avocado","Baklava","Balsamic",
        "Banana","Barbecue","Bacon","Basil","Bay Leaf","Bergamot","Blackberry","Blueberry","Broccoli",
        "Buttermilk","Cabbage","Camphor","Canaloupe","Cappuccino","Caramel","Caraway","Cardamom","Catnip","Cauliflower","Cayenne","Celery","Cherry",
        "Chervil","Chives","Chipotle","Chocolate","Coconut","Cookie Dough","Chicory","Chutney","Cilantro","Cinnamon","Clove",
        "Coriander","Cranberry","Croissant","Cucumber","Cupcake","Cumin","Curry","Dandelion","Dill","Durian","Eclair","Eggplant","Espresso","Felafel","Fennel",
        "Fenugreek","Fig","Garlic","Gelato","Gumbo","Honeydew","Hyssop","Ghost Pepper",
        "Ginger","Ginseng","Grapefruit","Habanero","Harissa","Hazelnut","Horseradish","Jalepeno","Juniper","Ketchup","Key Lime","Kiwi","Kohlrabi","Kumquat","Latte",
        "Lavender","Lemon Grass","Lemon Zest","Licorice","Macaron","Mango","Maple Syrup","Marjoram","Marshmallow",
        "Matcha","Mayonnaise","Mint","Mulberry","Mustard","Nectarine","Nutmeg","Olive Oil","Orange Peel","Oregano",
        "Papaya","Paprika","Parsley","Parsnip","Peach","Peanut","Pecan","Pennyroyal","Peppercorn","Persimmon",
        "Pineapple","Pistachio","Plum","Pomegranate","Poppy Seed","Pumpkin","Quince","Ragout","Raspberry","Ratatouille","Rosemary","Rosewater","Saffron","Sage","Sassafras",
        "Sea Salt","Sesame Seed","Shiitake","Sorrel","Soy Sauce","Spearmint","Strawberry","Strudel","Sunflower Seed","Sriracha","Tabasco","Tamarind","Tandoori","Tangerine",
        "Tarragon","Thyme","Tofu","Truffle","Tumeric","Valerian","Vanilla","Vinegar","Wasabi","Walnut","Watercress","Watermelon","Wheatgrass","Yarrow","Yuzu","Zucchini"];
    return names[Math.floor(Math.random() * names.length)];
}

const ThisUser = randomName();

Multisynq.Session.join({
    appId: "io.multisynq.ai-chat",
    apiKey: "234567_Paste_Your_Own_API_Key_Here_7654321",
    model: ChatModel,
    view: ChatView,
    viewData: {
        userName: ThisUser,
    },
    tps: 0, // since there are no future messages, we don't need ticks
});
