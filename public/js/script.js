
function openIncome() {
    document.getElementById("Income").style.height = "75%";
}


function openOutgoing() {
    document.getElementById("Outgoing").style.height = "75%";
}


function openSaving() {
    document.getElementById("Saving").style.height = "75%";
}
  


function closeIncome() {
    document.getElementById("Income").style.height = "0";
}

function closeOutgoing() {
    document.getElementById("Outgoing").style.height = "0";
}

function closeSaving() {
    document.getElementById("Saving").style.height = "0";
}

const labels = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
];

const data = {
    labels: labels,
    datasets: [{
        label: 'My First dataset',
        backgroundColor: 'rgb(255, 99, 132)',
        borderColor: 'rgb(255, 99, 132)',
        data: [0, 10, 5, 2, 20, 30, 45],
    }]
};

const config = {
    type: 'line',   
    data: data,
    options: {}
};

const myChart = new Chart(
    document.getElementById('myChart'),
    config
);