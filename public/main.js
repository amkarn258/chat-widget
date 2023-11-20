const socket = io();

fetch('/protectedRoute/data')
  .then(response => {
    checkUserSession();
    if (response.ok) {
      
    } else if (response.status === 401) {
      // User is not authenticated, redirect to login page
      window.location.href = '/login';
    } else {
    }
  })
  .catch(error => {
    console.error('Fetch error:', error);
  });


// Add a function to check the user session on application start
async function checkUserSession() {
  try {
    const response = await fetch('/checkSession'); // Create a new route on the server for this

    if (response.ok) {
      const data = await response.json();

      if (data && data.user_id && data.user_name && data.user_type) {
        console.log('User already logged in:', data);
        localStorage.setItem('userId', data.user_id);
        localStorage.setItem('userName', data.user_name);
        localStorage.setItem('userType', data.user_type);
        displayHostSelection();
        openAddConnectionWindow();
      } else {
        logout();
        console.log('No user session found.');
      }
    } else {
      logout();
      console.error('Error checking user session:', response.statusText);
    }
  } catch (error) {
    logout();
    console.error('Error checking user session:', error.message);
  }
}

checkUserSession();

function showCreateAccount() {
  document.getElementById("login-page").style.display = "none";
  document.getElementById("create-account-page").style.display = "block";
}

function showLoginPage() {
  document.getElementById("create-account-page").style.display = "none";
  document.getElementById("login-page").style.display = "block";
}
function createAccount() {
  const name = document.getElementById("create-name").value;
  const email = document.getElementById("create-email").value;
  const password = document.getElementById("create-password").value;
  const userType = document.getElementById("user-type").value; 
  const encodedPassword = btoa(password);
  const userObject = {
    name,
    email,
    encodedPassword,
    userType, 
  };

  saveUserToDatabase(userObject);
}


function saveUserToDatabase(userObject) {
  fetch("/saveUser", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userObject),
  })
    .then((response) => response.json())
    .then((data) => {
      showPopup("User added");
      clearFields();
    })
    .catch((error) => {
      console.error("Error saving user details to MongoDB:", error);
    });
}

function login() {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  const loginObject = {
    email,
    password
  };
  fetch("/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(loginObject),
  })
    .then((response) => {
      if (!response.ok) {
        if (response.status === 401) {
          showPopup("Wrong Credentials. Please try again.");
          clearFields();
        } else {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
      }
      return response.json();
    })
    .then((data) => {
      // Process data and set localStorage only for successful responses (status 200)
      if (data && data.user_id && data.user_name && data.user_type && data.connections) {
        console.log("User logged in:", data);
        localStorage.setItem('userId', data.user_id);
        localStorage.setItem('userName', data.user_name);
        localStorage.setItem('userType', data.user_type);
        localStorage.setItem('connections', JSON.stringify(data.connections));
        displayHostSelection();
        openAddConnectionWindow();
      } else {
        console.error("Incomplete or invalid data received.");
      }
    })
    .catch((error) => {
      console.error("Error:", error.message);
    });
}


function showPopup(message) {
  alert(message); // Just keeping a simple alert message
}

function clearFields() {
  // Clear all the fields
  document.getElementById("login-email").value = "";
  document.getElementById("login-password").value = "";
  document.getElementById("create-name").value = "";
  document.getElementById("create-email").value = "";
  document.getElementById("create-password").value = "";
  document.getElementById("user-type").value = "";
}

function displayHostSelection() {
  document.getElementById("login-page").style.display = "none";
  const hostSelection = document.getElementById('host-selection');
  const userType = localStorage.getItem('userType');
  hostSelection.style.display = 'block';
  
  const hosts = JSON.parse(localStorage.getItem('connections')) || [];
  const hostDropdown = document.getElementById('host-dropdown');
  
  hostDropdown.innerHTML = '';

  const headingText = userType === 'host' ? 'Select a User' : 'Select a Host';
  hostSelection.querySelector('h2').textContent = headingText;
  
  const buttonText = userType === 'host' ? 'Select User' : 'Select Host';
  document.getElementById('select-host-button').textContent = buttonText;
  hosts.forEach(host => {
    const option = document.createElement('option');
    option.value = host.id;
    option.textContent = host.name;
    hostDropdown.appendChild(option);
  });
  const existingLogoutButton = document.getElementById('logout-button');

  // Adding the logout button when user logs in and we display host selection window
  if (!existingLogoutButton) {
    const logoutButton = document.createElement('button');
    logoutButton.id = 'logout-button';
    logoutButton.textContent = 'Logout';
    logoutButton.onclick = logout;
    document.getElementById('host-selection').appendChild(logoutButton);
  }
}

function logout() {
  // Clear localStorage before going back to login page
  fetch('/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })
    .then((response) => {
      if (response.ok) {
        console.log('Logout successful');
        // Clear localStorage and update UI
        localStorage.clear();
        document.getElementById('login-page').style.display = 'block';
        document.getElementById('chat-page').style.display = 'none';
        document.getElementById('host-selection').style.display = 'none';
      } else {
        console.error('Error logging out:', response.statusText);
      }
    })
    .catch((error) => {
      console.error('Error logging out:', error.message);
    });
}

function selectHost() {
  checkUserSession();
  const hostDropdown = document.getElementById('host-dropdown');
  const selectedHostOption = hostDropdown.options[hostDropdown.selectedIndex];
  const receiverId = selectedHostOption ? selectedHostOption.value : "";
  const selectedHostName = selectedHostOption ? selectedHostOption.textContent : "";
  localStorage.setItem('receiverId', receiverId);
  const senderId = localStorage.getItem('userId');
  fetch("/fetchChatHistory", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ senderId, receiverId }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((chatHistory) => {

      displayChatHistory(chatHistory, selectedHostName);
    })
    .catch((error) => {
      console.error("Error fetching chat history:", error.message);
    });

  localStorage.setItem('selectedHostId', receiverId);

  showChatPage();
}


function displayChatHistory(chatHistory, selectedHostName) {
  const chatMessages = document.getElementById('chat-messages');
  chatMessages.innerHTML = '';

  const userName = localStorage.getItem('userName');
  chatHistory.forEach(chat => {
    const messageElement = document.createElement('div');

    const senderName = chat.sender === localStorage.getItem('userId') ? userName : selectedHostName;
    messageElement.textContent = `${senderName}: ${chat.message}`;

    chatMessages.appendChild(messageElement);
  });
}


function showChatPage() {
  document.getElementById("login-page").style.display = "none";
  document.getElementById("create-account-page").style.display = "none";
  document.getElementById("chat-page").style.display = "block";
}

function sendMessage() {
  checkUserSession();
  const messageInput = document.getElementById("message-input");
  const message = messageInput.value;
  if (message.trim() !== "") {
    const receiverId = localStorage.getItem('receiverId');
    const senderId = localStorage.getItem('userId');
    const senderName = localStorage.getItem('userName');
    socket.emit('newMessage', { sender: senderId, receiver: receiverId, message });

    var messageElement = document.createElement('div');
    messageElement.textContent = senderName + ': ' + message;
    var chatMessages = document.getElementById('chat-messages');
    chatMessages.appendChild(messageElement);
    messageInput.value = "";
  }
}


function openAddConnectionWindow() {
  const addConnectionWindow = document.getElementById('add-connection-window');
  addConnectionWindow.style.display = 'block';
}

function addConnection() {
  checkUserSession();
  const searchUsernameInput = document.getElementById('search-username');
  const searchUsername = searchUsernameInput.value.trim();

  if (searchUsername !== '') {
    const userId = localStorage.getItem('userId');
    const userName = localStorage.getItem('userName');
    fetch("/addConnection", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, userName, targetUsername: searchUsername }),
    })
      .then((response) => {
        if (response.ok) {
          showPopup("Connection successfully added");
          
          return response.json();
        } else if (response.status === 404) {
          showPopup("User not found");
        } else {
          showPopup("Error adding connection");
        }
        return null;
      })
      .then((data) => {
        if (data) {
          // Updating real time as well since the request response is 200
          addNewConnection(data.targetUserIdString, searchUsername);
        }
      })
      .catch((error) => {
        console.error("Error adding connection:", error.message);
      });

    clearAddConnectionWindow();
  }
}



function clearAddConnectionWindow() {
  const searchUsernameInput = document.getElementById('search-username');
  searchUsernameInput.value = '';
}

function addNewConnection(targetUserIdString, searchUsername) {
  const connections = JSON.parse(localStorage.getItem('connections')) || [];
  const existingConnection = connections.find(connection => connection.id === targetUserIdString);
  if (!existingConnection) {
    connections.push({
      id: targetUserIdString,
      name: searchUsername,
    });

    localStorage.setItem('connections', JSON.stringify(connections));
  }
  displayHostSelection();
}




window.showCreateAccount = showCreateAccount;
window.showLoginPage = showLoginPage;
window.createAccount = createAccount;
window.login = login;
window.showChatPage = showChatPage;
window.sendMessage = sendMessage;
window.selectHost = selectHost;
window.addConnection = addConnection;
window.openAddConnectionWindow = openAddConnectionWindow;