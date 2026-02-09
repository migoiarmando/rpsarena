// client.c
/* Filename:
 *      client.c
 *
 * Description:
 *      This is the client for the game.
 *
 * Compile Instructions:
 *      `gcc -o client client.c`
 *
 * Author:
 *
 *      Charies Ann Hao
 *      Christian Del Rosario
 *      Gabriel Señar
 *      James Andrei Aguilar
 *      Miguel Armand Sta Ana
 *
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <stdbool.h>

// ERROR HANDLER
void die_with_error(char *error_msg) {
    perror(error_msg);
    exit(-1);
}

// DISPLAY THE HEALTH BAR
void display_health_bar(const char* player_label, int hp) {
    int holder = hp / 10;
    char healthbar[11] = {0}; // INITIALIZE WITH NULL CHARACTERS
    for(int i = 0; i < holder; i++) {
        healthbar[i] = '=';
    }
    printf("%s HP: ", player_label);
    for(int i = 0; i < holder; i++) {
        printf("%c", healthbar[i]);
    }
    printf(" (%d)\n", hp);
}

int main(int argc, char *argv[]) {
    if (argc != 4) {
        printf("Usage: %s <Server IP> <Server Port> <Client ID>\n", argv[0]);
        return -1;
    }

    int client_socket;
    struct sockaddr_in server_addr;

    client_socket = socket(AF_INET, SOCK_STREAM, 0);
    if (client_socket < 0)
        die_with_error("Error: socket() failed");

    memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = inet_addr(argv[1]);
    server_addr.sin_port = htons(atoi(argv[2]));

    if (connect(client_socket, (struct sockaddr *)&server_addr, sizeof(server_addr)) < 0)
        die_with_error("Error: connect() failed");

// INITIALIZE START SCREEN

    printf(" .----------------.  .----------------.  .----------------.                    .----------------.  .----------------.  .----------------.  .-----------------. .----------------. \n");
    printf("| .--------------. || .--------------. || .--------------. |                  | .--------------. || .--------------. || .--------------. || .--------------. || .--------------. |\n");
    printf("| |  _______     | || |   ______     | || |    _______   | |                  | |      __      | || |  _______     | || |  _________   | || | ____  _____  | || |      __      | |\n");
    printf("| | |_   __ \\    | || |  |_   __ \\   | || |   /  ___  |  | |                  | |     /  \\     | || | |_   __ \\    | || | |_   ___  |  | || ||_   \\|_   _| | || |     /  \\     | |\n");
    printf("| |   | |__) |   | || |    | |__) |  | || |  |  (__ \\_|  | |                  | |    / /\\ \\    | || |   | |__) |   | || |   | |_  \\_|  | || |  |   \\ | |   | || |    / /\\ \\    | |\n");
    printf("| |   |  __ /    | || |    |  ___/   | || |   '.___`-.   | |                  | |   / ____ \\   | || |   |  __ /    | || |   |  _|  _   | || |  | |\\ \\| |   | || |   / ____ \\   | |\n");
    printf("| |  _| |  \\ \\_  | || |   _| |_      | || |  |`\\____) |  | |                  | | _/ /    \\ \\_ | || |  _| |  \\ \\_  | || |  _| |___/ |  | || | _| |_\\   |_  | || | _/ /    \\ \\_ | |\n");
    printf("| | |____| |___| | || |  |_____|     | || |  |_______.'  | |                  | ||____|  |____|| || | |____| |___| | || | |_________|  | || ||_____\\____| | || ||____|  |____|| |\n");
    printf("| |              | || |              | || |              | |                  | |              | || |              | || |              | || |              | || |              | |\n");
    printf("| '--------------' || '--------------' || '--------------' |                  | '--------------' || '--------------' || '--------------' || '--------------' || '--------------' |\n");
    printf(" '----------------'  '----------------'  '----------------'                    '----------------'  '----------------'  '----------------'  '----------------'  '----------------' \n");
    
    
    printf("                                                                         ..   .:+*+:..              \n");
    printf("                                                                       .*%%##-..%%:.:#-........       \n");
    printf("                                                                     ..%%:..+*.=%%. .*=..*#+#*..      \n");
    printf("                                                                      :%%. .=#:+#. .*-.:%%:..*-.      \n");
    printf("               .....                                                  .%%.  :%%:**. .#-.*+. .%%:       \n");
    printf("       ..:=*###%%#++*@=:....                                           .%%=. .%%:**...#-.%%:..+*.+*=..  \n");
    printf("       .%%=....%%.   .=::=##-..                                          +#. .*=#*  :#:+#..:#+%%-.-*:. \n");
    printf("       -%%.    +.   .=:.  .%%=...                                ......  .%%. .+##*. :#:%%-..+#%%-..=*.  \n");
    printf("       -%%.    =-   .-:   .*###*-..                           ..-%%##*=...%%-  :%%#*..:#=%%..:#@=..-%%:.  \n");
    printf("     ..-%%...::++:.. -:  ..+:..-%%-.                            .**...=%%:.+*...=*=. .*%%*..=@*:..%%=.   \n");
    printf("     .:*#===-...-+-.=:  .--. .=%%-.                             .**. .+*.:%%.        .....*%%-..+*.    \n");
    printf("     .%%-....     .:=%%.  .+-...=%%-.                              .#+..:%%.=%%..            .. .-%%.     \n");
    printf("    .=%%..        ....-*.-=.  .##:.                               :#-..-#%%-:=:..           ..%%-.     \n");
    printf("    .+*.  ..:=-......+*+=+=..=**..                               .=*.. .....:=*..         .+#.      \n");
    printf("    .*+.  ..:..:-=--:......::.-*.          ...                   ..*=.      ...-+.        -%%:       \n");
    printf("    .*+.   .. .. .. .        .-*..        .+%%#=..   ..::...     ..=%%:.       ..=:.      :#=.       \n");
    printf("     .*%%-..                 ..#+.       ..%%-...+*. .:*+::-#+.     ..=%%:        ...      .++..       \n");
    printf("       .-%%#-..            ..=@-.         .%%:  .-#. .=*:.  =*.        :%%-.             ..+*.         \n");
    printf("         ..:*@%%+=-:....-=#@*:.           .%%-   -%%:..++.. .*+.         .+@=.............#+.          \n");
    printf("              ....-==--....              .#=.  :%%:.:#-.  .%%:.           .:+%%#%%%%%%%%+..           \n");
    printf("                                         .**.  :#:.=*.  .=#.                                        \n");
    printf("                                          =%%.  .#-.*=.  .%%=.                                        \n");
    printf("                                          :%%.  .*=:%%:. .:@.                                         \n");
    printf("                                          .%%:  .+#**.. .**.                                         \n");
    printf("                                          .%%-   ..:.. .-##*-.                                        \n");
    printf("                                          .#=.       .=-..:**..                                      \n");
    printf("                                         .-%%. ....  .-=.. .+=**.                                     \n");
    printf("                                         :%%*==----+=:=:. .-+..#-                                     \n");
    printf("                                        .*+..     ..:=+-..*..:#:                                     \n");
    printf("                                        .#-. .....   .:+.*:..*=.                                     \n");
    printf("                                        .#- .=*--**==*=.-#:.+*..                                     \n");
    printf("                                        .*+...   .       ..-#-.                                      \n");
    printf("                                        .:@:..           ..*+.                                       \n");
    printf("                                          -%%=..........:-*%%=..                                       \n");
    printf("\n");
    
// RECEIVE AND DISPLAY WELCOME MESSAGES
    char welcome_msg[256];
    if (recv(client_socket, welcome_msg, sizeof(welcome_msg), 0) < 0)
        die_with_error("Error: recv() welcome message failed");
    printf("%s\n", welcome_msg);
    printf("\n");

    // MAIN GAME LOOP
    int my_hp, opponent_hp;
    char choice;
    char round_winner[256];
    while (1) {
    
        // MOVE INPUT
        printf("\n");
        printf("Enter your choice (Rock [r], Paper [p], Scissors [s]): ");
        scanf(" %c", &choice);
        while (choice != 'r' && choice != 'p' && choice != 's') {
            printf("Invalid input. Please enter 'r', 'p', or 's': ");
            scanf(" %c", &choice);
        }

        // SEND MOVE
        if (send(client_socket, &choice, sizeof(choice), 0) < 0)
            die_with_error("Error: send() failed");

        // RECEIVE ROUND WINNER MESSAGE
        if (recv(client_socket, round_winner, sizeof(round_winner), 0) < 0)
            die_with_error("Error: recv() failed");
        printf("%s\n", round_winner);  // Add a blank line after the round winner message

        // RECEIVE YOUR HP
        if (recv(client_socket, &my_hp, sizeof(my_hp), 0) < 0)
            die_with_error("Error: recv() failed");
            
        // DISPLAY THE HEALTH BAR FOR PLAYER 1
        display_health_bar("Your", my_hp);
        printf("\n");

        // RECEIVE THE OPPONENT'S HP
        if (recv(client_socket, &opponent_hp, sizeof(opponent_hp), 0) < 0)
            die_with_error("Error: recv() failed");
        
        // DISPLAY THE HEALTH BAR FOR PLAYER 2
        display_health_bar("Opponent's", opponent_hp);

        // CHECKS IF THE GAME IS OVER
        if (my_hp <= 0) {
            printf("\n");
            printf("Game Over, You lose!\n");
            break;
        }
        if (opponent_hp <= 0) {
            printf("\n");
            printf("Congratulations, You win!\n");
            break;
        }
    }

    // CLOSE SOCKET
    close(client_socket);
    return 0;
}
