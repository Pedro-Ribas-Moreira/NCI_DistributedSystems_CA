const quiz_list = [{
        id : 1,
        status: "active",
        title: "History Quiz",
        questions: [
            {
                question_id: 1,
                question: "Who was the first President of the United States?",
                options: [{title: "George Washington", id: 1}, {title: "Thomas Jefferson", id: 2}, {title: "Abraham Lincoln", id: 3}, {title: "John Adams", id: 4}],
                correct: {title: "George Washington", id: 1}    
            },
            {   
                question_id: 2,
                question: "In which year did World War II end?",
                options: [{title: "1940", id: 1}, {title: "1945", id: 2}, {title: "1918", id: 3}, {title: "1939", id: 4}],
                correct: {title: "1945", id: 2}
            },
            {
                question_id: 3,
                question: "Which ancient civilization built Machu Picchu?",
                options: [{title: "Aztec", id: 1}, {title: "Maya", id: 2}, {title: "Inca", id: 3}, {title: "Olmec", id: 4}],
                correct: {title: "Inca", id: 3}
            },
            {
                question_id: 4,
                question: "Who discovered the sea route to India in 1498?",
                options: [{title: "Christopher Columbus", id: 1}, {title: "Vasco da Gama", id: 2}, {title: "Ferdinand Magellan", id: 3}, {title: "James Cook", id: 4}],
                correct: {title: "Vasco da Gama", id: 2}
            },
            {
                question_id: 5,
                question: "The French Revolution began in which year?",
                options: [{title: "1789", id: 1}, {title: "1776", id: 2}, {title: "1812", id: 3}, {title: "1804", id: 4}    ],
                correct: {title: "1789", id: 1}
            }
    ]
}
]




module.exports = {
    quiz_list
}   