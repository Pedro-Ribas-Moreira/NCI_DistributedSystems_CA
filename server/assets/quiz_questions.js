const quiz_list = [{
        id : 1,
        status: "active",
        title: "History Quiz",
        questions: [
            {
                question_id: 1,
                question: "Who was the first President of the United States?",
                options: ["George Washington", "Thomas Jefferson", "Abraham Lincoln", "John Adams"],
                correct: "George Washington"
            },
            {   
                question_id: 2,
                question: "In which year did World War II end?",
                options: ["1940", "1945", "1918", "1939"],
                correct: "1945"
            },
            {
                question_id: 3,
                question: "Which ancient civilization built Machu Picchu?",
                options: ["Aztec", "Maya", "Inca", "Olmec"],
                correct: "Inca"
            },
            {
                question_id: 4,
                question: "Who discovered the sea route to India in 1498?",
                options: ["Christopher Columbus", "Vasco da Gama", "Ferdinand Magellan", "James Cook"],
                correct: "Vasco da Gama"
            },
            {
                question_id: 5,
                question: "The French Revolution began in which year?",
                options: ["1789", "1776", "1812", "1804"],
                correct: "1789"
            }
    ]
}
]




module.exports = {
    quiz_list
}   