# oklang

Small language of facts and rules, easy to write & reason about.

## Walkthrough

Fill an environment with facts, apply a set of rules, and you end up with new
environment of facts.

Let's start with some facts.
```
apples on the table.
bananas on the table.
pineapple in the fridge.
```

When declaring facts, you can separate by commas or periods, atm there's not a
difference.
```
apples on the table, bananas on the table, pineapple in the fridge.
```

Whitespace doesn't matter.
```
apples on
the     table,    bananas on the
table.
pineapple in the fridge.
```

Now let's add a rule to the system.
```
I want a fruit salad => making a fruit salad.
```

The facts on the left side of the rule (predicate) are removed from the
environment, and the facts on the right are introduced.

But only if the predicate facts match. So let's set our environment to:
```
apples on the table, bananas on the table, pineapple in the fridge.
I want a fruit salad.
```

Now if we apply the rule, our new environment looks like:
```
apples on the table, bananas on the table, pineapple in the fridge.
making a fruit salad.
```

OK, let's define some rules to make this happen.
```
making a fruit salad, $fruit on the table =>
    making a fruit salad,
    diced $fruit.
making a fruit salad, $fruit in the fridge =>
    making a fruit salad,
    diced $fruit.
```

Notice that, because we want to keep the "making a fruit salad" fact around, it
gets redeclared in the rule result.

Running this script once yields:
```
bananas on the table.
pineapple in the fridge.
making a fruit salad.
diced apples.
```

In other words, the first rule's predicate matched two facts ("making a fruit
salad" and "apples on the table"), so we (re)declare the "making a fruit salad"
fact, and declare the new rule "diced apples."

Running this script again yields:
```
pineapple in the fridge.
diced apples.
making a fruit salad.
diced bananas.
```

On the third run, the first rule doesn't match, so the system  tries the second rule.
```
diced apples.
diced bananas.
making a fruit salad.
diced pineapple.
```

Running these rules some more does nothing, since neither matches. So we have
some cut up fruit, let's continue defining our process:
```
( ...omitting prior rules.. )
making a fruit salad, diced $fruit =>
    making a fruit salad,
    $fruit in bowl.
```

Apply the rules until we get to a standstill:
```
making a fruit salad, apples in bowl, bananas in bowl, pineapple in bowl.
```

Let's say we need three fruits in a bowl for it to be a fruit salad. We should
encode this so we know when we've crossed the threshhold from "just a bunch of
sliced fruit" to "yes that's a fruit salad."
```
making a fruit salad, have 3 fruits in bowl =>
    I *finally* have a fruit salad.

making a fruit salad, have $n fruits in bowl, $fruit in bowl  =>
    making a fruit salad, 
    have $(n+1) fruits in bowl.
```

Additionally, we need to create a "have 0 fruits in bowl" type rule so the above
will match. The simplest way to do this is to declare it in the "I want a fruit
salad" rule, like so:
```
I want a fruit salad =>
    making a fruit salad,
    have 0 fruits in bowl.
```

If we run this to completion, our environment ends up looking like:
```
I *finally* have a fruit salad.
```

### All at once

So, to summarize, we start with these facts...
```
I want a fruit salad.
apples on the table, bananas on the table, pineapple in the fridge.
```

...and we run these rules...
```
I want a fruit salad => 
    making a fruit salad,
    have 0 fruits in bowl.

( gather ingredients and prepare them )
making a fruit salad, $fruit on the table =>
    making a fruit salad,
    diced $fruit.
making a fruit salad, $fruit in the fridge =>
    making a fruit salad,
    diced $fruit.

( add the prepared ingredients to a bowl )
making a fruit salad, diced $fruit =>
    making a fruit salad,
    $fruit in bowl.

( figure out if we've completed a fruit salad )
making a fruit salad, have 3 fruits in bowl =>
    I *finally* have a fruit salad.

making a fruit salad, have $n fruits in bowl, $fruit in bowl  =>
    making a fruit salad, 
    have $(n+1) fruits in bowl.

making a fruit salad, $fruit in bowl =>
    making a fruit salad,
    have 1 fruits in bowl.
```

...and we end up with a single fact, `I *finally* have a fruit salad." 

NB: I'm more likely to have the apple in the fridge and the pineapple on the
table, but the example still works?

### Notes on the above example

Note about combining or splitting the "$X on the table" vs "$X in the fridge"
rules.

Note about changing the order of facts (ie., can also start with rules, add "I
want a fruit salad," then introduce facts about where the food is one at a
time). Maybe demonstrate via the repl.

## TODO

Synopsis of full syntax:
```
( this is a comment, it can go anywhere )
fact 1, fact 2.
fact 3.
when true.
fact $N, fact $(N+1), fact $M, when $(M>N) =>
    N is $N,
    N + 1 is $(N+1),
    new symbol $new [[quoted word looks like this]],
    N * M is $(N * M).
```
