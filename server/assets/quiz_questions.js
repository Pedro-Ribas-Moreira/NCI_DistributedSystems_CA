const quiz_list = [{
        id : 1,
        status: "inactive",
        title: "History Quiz",
        questions: [
            {
                question_id: 1,
                question: "Who was the first President of the United States?",
                options: [{option_title: "George Washington", option_id: 1}, {option_title: "Thomas Jefferson", option_id: 2}, {option_title: "Abraham Lincoln", option_id: 3}, {option_title: "John Adams", option_id: 4}],
                correct: {option_title: "George Washington", option_id: 1}    
            },
            {   
                question_id: 2,
                question: "In which year did World War II end?",
                options: [{option_title: "1940", option_id: 1}, {option_title: "1945", option_id: 2}, {option_title: "1918", option_id: 3}, {option_title: "1939", option_id: 4}],
                correct: {option_title: "1945", option_id: 2}
            },
            {
                question_id: 3,
                question: "Which ancient civilization built Machu Picchu?",
                options: [{option_title: "Aztec", option_id: 1}, {option_title: "Maya", option_id: 2}, {option_title: "Inca", option_id: 3}, {option_title: "Olmec", option_id: 4}],
                correct: {option_title: "Inca", option_id: 3}
            },
            {
                question_id: 4,
                question: "Who discovered the sea route to India in 1498?",
                options: [{option_title: "Christopher Columbus", option_id: 1}, {option_title: "Vasco da Gama", option_id: 2}, {option_title: "Ferdinand Magellan", option_id: 3}, {option_title: "James Cook", option_id: 4}],
                correct: {option_title: "Vasco da Gama", option_id: 2}
            },
            {
                question_id: 5,
                question: "The French Revolution began in which year?",
                options: [{option_title: "1789", option_id: 1}, {option_title: "1776", option_id: 2}, {option_title: "1812", option_id: 3}, {option_title: "1804", option_id: 4}    ],
                correct: {option_title: "1789", option_id: 1}
            }
    ]
}
]




module.exports = {
    quiz_list
}   