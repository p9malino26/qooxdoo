<?php

class class_test
{
    /**
     * Echo the (one and only) parameter.
     *
     * @param params
     *   An array containing the parameters to this method
     *
     * @param error
     *   An object of class JsonRpcError.
     *
     * @return
     *   Success: The object containing the result of the method;
     *   Failure: null
     */
    function method_echo($params, $error)
    {
        if (count($params) != 1)
        {
            $error->SetError(JsonRpcError_ParameterMismatch,
                             "Expected 1 parameter; got " . count($params));
            return $error;
        }
        return "Client said: [" . $params[0] . "]";
    }
    
    /**
     * Sink all data and never return.
     *
     * @param params
     *   An array containing the parameters to this method (none expected)
     *
     * @param error
     *   An object of class JsonRpcError.
     *
     * @return
     *   Never
     */
    function method_sink($params, $error)
    {
        /* We're never supposed to return.  Just sleep for a long time. */
        sleep(240);
    }
    
    /**
     * Sleep for the number of seconds specified by the parameter.
     *
     * @param params
     *   An array containing the parameters to this method (one expected)
     *
     * @param error
     *   An object of class JsonRpcError.
     *
     * @return
     *   Success: The object containing the result of the method;
     *   Failure: null
     */
    function method_sleep($params, $error)
    {
        if (count($params) != 1)
        {
            $error->SetError(JsonRpcError_ParameterMismatch,
                             "Expected 1 parameter; got " . count($params));
            return null;
        }
        
        sleep(intval($params[0]));
        return $params[0];
    }
    

    /*************************************************************************/

    /*
     * The remainder of the functions test each individual primitive type, and
     * test echoing arbitrary types.  Hopefully the name is self-explanatory.
     */

    function method_getInteger($params, $error)
    {
        return 1;
    }
    
    function method_getFloat($params, $error)
    {
        return 1/3;
    }
    
    function method_getString($params, $error)
    {
        return "Hello world";
    }
    
    function method_getBadString($params, $error)
    {
        return "<!DOCTYPE HTML \"-//IETF//DTD HTML 2.0//EN\">";
    }
    
    function method_getArrayInteger($params, $error)
    {
        return array(1, 2, 3, 4);
    }
    
    function method_getArrayString($params, $error)
    {
        return array("one", "two", "three", "four");
    }
    
    function method_getObject($params, $error)
    {
        return new JSON(); // some arbitrary object
    }
    
    function method_getTrue($params, $error)
    {
        return true;
    }
    
    function method_getFalse($params, $error)
    {
        return false;
    }
    
    function method_getNull($params, $error)
    {
        return null;
    }

    function method_isInteger($params, $error)
    {
        return is_int($params[0]);
    }
    
    function method_isFloat($params, $error)
    {
        return is_float($params[0]);
    }
    
    function method_isString($params, $error)
    {
        return is_string($params[0]);
    }
    
    function method_isBoolean($params, $error)
    {
        return is_bool($params[0]);
    }
    
    function method_isArray($params, $error)
    {
        return is_array($params[0]);
    }
    
    function method_isObject($params, $error)
    {
        return is_object($params[0]);
    }
    
    function method_isNull($params, $error)
    {
        return is_null($params[0]);
    }
    
    function method_getParams($params, $error)
    {
        return $params;
    }	
    
    function method_getParam($params, $error)
    {
/*
        if (get_class($params[0]) == "JSON_Date")
        {
            $d = $params[0];
            debug("Date = " .
                  $d->getUtcYear() . "/" .
                  $d->getUtcMonth() . "/" .
                  $d->getUtcDay() . " at " .
                  $d->getUtcHour() . ":" .
                  $d->getUtcMinute() . ":" .
                  $d->getUtcSecond() . "." .
                  $d->getUtcMilliseconds() . " which is epoch time " .
                  $d->getEpochTime());
        }
*/
        return $params[0];
    }	
    
    function method_getCurrentTimestamp()
    {
        $now = time();
        $obj = new stdClass();
        $obj->now = $now;
        $obj->json = new JSON_Date();
        return $obj;
    }

    function method_getError($params, $error)
    {
        $error->SetError(JsonRpcError_FIRST_APPLICATION_ERROR,
                         "This is an application-provided error");
        return $error;
    }	
}

?>