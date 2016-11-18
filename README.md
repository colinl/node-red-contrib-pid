node-red-contrib-pid
=====================

A [Node-RED] node which operates as a PID loop controller node intended for the control of real world processes.


Install
-------

Run the following command in the root directory of your Node-RED install

    npm install node-red-contrib-pid


Usage
-----

Pass the node a process value in **msg.payload** at regular intervals and configure (or pass in via a message) a setpoint and tuning parameters and the algorithm will generate a required power output between 0 and 1 in **msg.payload** using a Proportional+Integral+Derivative algorithm.
    
Any message received with a **msg.topic** other than those defined below is assumed to contain the current process value in **msg.payload** and the control algorithm will be run, passing on the required power in **msg.payload**.

The properties below can also be set using **msg.---**. For example, to change the setpoint you can set the message attribute **msg.setpoint** to the required value. Using this method, it is possible to set multiple PID properties using the same message. When using this method to set the properties **msg.payload** should contain the process value.

A sample flow demonstrating usage is available at http://flows.nodered.org/flow/42f125b56a00dd5d1433c2f8023263e9


Configuration
-------------

  * **Setpoint** - This is the process value that the process is aiming for. It may be setup either in the configuration of the node or by passing the node a message with **msg.topic** set to `setpoint` and **msg.payload** set to the required floating point value.

  * **Proportional band** - This controls the gain of the loop and is the range of process value over which the power output will go from 0 to full power. The units are that of the process and setpoint, so for example in a heating application it might be set to 1.5 degrees. It may be setup either in the configuration of the node or by passing the node a message with **msg.topic** set to `prop_band` and **msg.payload** set to the required floating point value.

  * **Integral time** - This is a setting for the integral time, in seconds. It represents the time constant of the integration effect. The larger the value the slower the integral effect will be. Obviously the slower the process is the larger this should be. For example for a domestic room heated by convection radiators a setting of one or two hours might be appropriate (in seconds). To disable the integral effect set this to a large number. It may be setup either in the configuration of the node or by passing the node a message with **msg.topic** set to `t_integral` and **msg.payload** set to the required integer value.

  * **Derivative time** - This is a setting for the derivative time, in seconds. It represents the time constant of the derivative effect. The larger the value the greater will be the derivative effect. Typically this will be set to somewhat less than 25% of the integral setting, once the integral has been adjusted to the optimum value. To disable the derivative effect set this to 0. When initially tuning a loop it is often sensible to start with derivative zero and wind it in once other parameters have been setup. It may be setup either in the configuration of the node or by passing the node a message with **msg.topic** set to `t_derivative` and **msg.payload** set to the required integer value.

  * **Initial integral** - This is an initial value which is used to preset the integrated error value when the flow is deployed in order to assist in homing in on the setpoint the first time. It should be set to an estimate of what the power requirement might be in order to maintain the process at the setpoint. For example for a domestic room heating application it might be set to 0.2 indicating that 20% of the available power might be required to maintain the setpoint.  The value is of no consequence apart from on deployment of the flow.

  * **Max sample interval** - This is the maximum time in seconds that is expected between samples. It is provided to cope with unusual situations such as a faulty sensor that might prevent the node from being supplied with a process value and to prevent the problem of integral wind-up during that time. Each time a process value is received a check is made on the time since the last sample and if too long has elapsed the integral error term is locked at the previous value and the derivative component is set to zero. It may be setup either in the configuration of the node or by passing the node a message with **msg.topic** set to `max_interval` and **msg.payload** set to the required integer value.

  * **Derivative smoothing factor** - In situations where the process sensor has limited resolution (such as the DS18B20), the use of deriviative can be problematic as when the process is changing only slowly the steps in the value cause spikes in the derivative. To reduce the effect of these this parameter can be set to apply a filter to the derivative term.  I have found that with the DS18B20 that a value of 3 here can be beneficial, providing effectively a low pass filter on the derivative at 1/3 of the derivative time. This feature may also be useful if the process value is particularly noisy. The smaller the value the greater the filtering effect but the more it will reduce the effectiveness of the derivative. A value of zero disables this feature. It may be setup either in the configuration of the node or by passing the node a message with **msg.topic** set to `smooth_factor` and **msg.payload** set to the required value.

  * **Enable state** - This is can be used to enable or disable the control (1=enable, 0=disable). When disabled the output is set the value defined in the parameter below. Enable/disable may be setup either in the configuration of the node or by passing the node a message with **msg.topic** set to `enable` and **msg.payload** set to 1/0 or true/false.

  * **Output power when disabled** - This is the value the output is set to when the loop is disabled. It may be setup either in the configuration of the node or by passing the node a message with **msg.topic** set to `disabled_op` and **msg.payload** set to the required floating point value between 0 and 1.

  
Status
------

The status text will normally be empty. In unusual conditions it will show the following values.

  * **Disabled** - Control is currently disabled.
  
  * **Integral Locked** - The process is far from the setpoint and the integral term has been locked to prevent integral windup.
  
  * **Bad PV** - The process value passed in is not a number.
  
  * **Too long since last sample** - A long time has elapsed since the last good sample so the integral term will not be accumulated for this sample.


[Node-RED]:  http://nodered.org/

