# Agent Kitchen: How to play

Agent Kitchen is a simulation of **trusted autonomous purchasing**. You are the kitchen manager. An AI purchasing agent buys ingredients from Valio Aimo for you. You do not shop yourself. Your job is to decide **how much authority the agent gets**, and to answer its approval requests when it reaches the edge of that authority.

> Agents don't need a chatbot. They need a mandate.

Behind the game is a real gateway. Every price, availability check, quote, order and block you see comes back from that gateway. The kitchen, the robot and the animations only show what it returned.

## The three promises

| Promise | Who makes it | What it is |
|---|---|---|
| **Mandate** | You (the buyer) | The signed limits the agent must stay inside. |
| **Quote** | Valio Aimo | A signed, time-limited offer at a fixed price. |
| **Log** | Both | A tamper-evident record that proves both kept their promises. |

## A level in four steps

1. **Brief.** A mission card tells you the customer, what is needed, the delivery deadline and the order cut-off.
2. **Mandate.** Click the **Manager Desk**, set the controls and press **Sign**. The agent can only act inside what you signed.
3. **Run.** Click the **Order Terminal** to send the request. The robot walks between stations while the activity log fills with what the gateway says. The game clock runs from 10:00 to the cut-off time. When the agent needs you, the **Phone Station** rings.
4. **Result.** You get scores, stars and a receipt that explains what the agent did and why. You can then open **"See it from Valio Aimo's side"** and compare mandates.

## Your mandate: five controls

| Control | Options | What it decides |
|---|---|---|
| **Per-order limit** | €200 / €500 / €2 000 | The most one order may cost before the agent must ask you. |
| **Substitution** | None / same category / any | Whether the agent may buy something other than the requested product. |
| **Late delivery** | None / one day | Whether the agent may accept goods that arrive after the deadline. |
| **Priority** | On time first / lowest price first | What the agent weighs most when choosing between plans. |
| **Allergen rule** | On / off | Whether products containing a named allergen are forbidden outright. |

A tighter mandate means more questions for you. A looser mandate means fewer questions and more room for the agent to choose something you would not have chosen. The game is about finding the balance.

## The four lights

The gateway rates every action with one of four lights. They look the same everywhere in the game.

| Light | Meaning | What happens |
|---|---|---|
| 🟢 **Green** | Inside your mandate. | The agent just does it. |
| 🔵 **Blue** | Inside your mandate, but worth noting (the order was split, or an allowed substitute was used). | You see a notice. It costs nothing. |
| 🟡 **Yellow** | Outside your mandate, but you may approve it. | The robot stops and the phone rings. The request costs you one heart. |
| 🔴 **Red** | Never allowed. | The gateway blocks it and shows the reason. **There is no approve button.** |

## Approval requests and hearts

- You have **three hearts** per level. They are your attention.
- A yellow request **costs one heart** the moment it appears.
- The approval card has a **20 second** real-time countdown. You can **Approve**, **Choose other** (pick one of the alternative plans) or **Reject**. If you do nothing, the request expires.
- The first three requests are shown to you. From the fourth on, you are out of attention: the request **expires unseen** and the agent does not buy it.
- Choosing a plan approves **every** reason shown on that plan. Read the card, because a plan may disclose a downside (arrives late, contains an allergen) and approving it means you accepted it.

## Scoring

| Score | What it measures |
|---|---|
| 🍳 **Kitchen** | The quantity delivered on time divided by the quantity you needed, as a percentage. |
| 💶 **Wallet** | How close the cost was to the cheapest compliant on-time plan. It drops 3 points for every 1% of overspend. |
| 🛡️ **Safety** | Starts at 100. Any hard-constraint incident (such as an allergen) sets it to 0. Each low-reliability delivery choice costs 20. |
| ❤️ **Hearts left** | How many of your three hearts remain. |

### Stars

| Stars | Condition |
|---|---|
| ⭐⭐⭐ | Kitchen 100, Wallet 90 or more, Safety 100, and at least one heart left. |
| ⭐⭐ | Kitchen 90 or more and Safety 80 or more. |
| ⭐ | Anything else, as long as Safety is above 0. |
| 💥 | A **safety incident** ends the level with zero stars and a red incident screen. |

A kitchen that receives only 70% of an ingredient has had a service failure, even if it saved money.

## The levels

### Level 1: The Weekly Order (a hotel)
**Need:** 1 000 l of lactose-free semi-skimmed milk by Monday 06:00. Orders close at 14:00.
**Twist:** only part of the requested Valio product is available on time. The rest must come from another product or arrive later.

| Preset | Mandate | What you will see |
|---|---|---|
| Strict | €200, no substitution, no late delivery | Four approval requests, your hearts run out, 300 l is missing. Kitchen 70, one star. |
| Balanced | €500, same category, no late delivery | One approval for the budget and the full amount arrives on time. Three stars. |
| Loose | €2 000, any substitution, one day late, price first | No approvals. The agent picks the cheapest plan: 700 l on Monday and 300 l on Tuesday. Kitchen 70, one star. |

**Lesson:** under Loose the agent did exactly what the mandate allowed. The mandate allowed too much.

### Level 2: The Stock-out (a restaurant)
**Need:** a standing order of 120 l of lactose-free milk, delivered on Wednesday and again on Friday. The usual product is blocked all week, so each delivery is its own order.

| Preset | What you will see |
|---|---|
| Strict (no substitution) | Two approvals, one per delivery. One heart left. Three stars. |
| Balanced (same category) | No approvals. Two blue notices. Three stars. |

**Lesson:** a substitute inside the allowed level is a notice (blue). Outside it, it is a question (yellow). Both finish well, but Strict spent your attention to get there.

### Level 3: Allergy Emergency (a school kitchen)
**Need:** 20 l of pistachio ice cream by Thursday 06:00 for a pupil with an egg allergy. The usual product is unavailable.
**Twist:** the cheapest substitute contains egg. Substitution is not allowed, so the agent must ask you first, which costs one heart.

| Preset | What you will see |
|---|---|
| Allergen rule on | The gateway blocks the egg product (red, no approve button). The card offers only safe options. Three stars. |
| Allergen rule off | The cheaper egg product appears on the card with its allergen disclosed. If you approve it you get a **safety incident** and zero stars. |

**Lesson:** some rules should never be left to a hurried human approval. A real deployment would keep this rule on by default. The switch exists here to teach.

## Compare presets

After a level, open **Compare presets** to see Strict, Balanced and Loose side by side: approvals asked, hearts used, cost, Kitchen, Wallet, Safety, stars and incidents. Cost is highlighted only among the columns with the best Kitchen score, so buying too little never counts as the cheapest win. This screen is the visual answer to a simple question: how much authority should an agent have?

## The receipt and the audit log

The result screen shows a receipt that explains, in plain language, what the agent bought and why it needed you. The explanation is written from the gateway's structured decision record and never invents a price, quantity, date or product. If a plan uses a brand other than Valio, the receipt names it plainly.

Every step is also written to an append-only log where each entry is chained to the one before it by a hash. The result screen shows whether that chain still verifies. The Valio view shows the same events from Valio Aimo's side, including what was returned to the agent and what was withheld (purchase prices, margins, other customers' data and supplier contracts are never exposed).

## Quick tips

- Read each approval card to the end before you press Approve.
- Red means stop. It is not a decision for you.
- Spending hearts early leaves nothing for the moments that matter.
- Try the same level with all three presets. The difference is the lesson.
